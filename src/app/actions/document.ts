'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { storeTemp, readTemp, purgeTemp } from '@/lib/storage/temp';
import { analyzeDocument } from '@/lib/ai/analyze';
import { extractText } from '@/lib/ocr/extract';
import { appendAuditLog } from '@/lib/audit/log';
import { humanAgreesWithAi, reviewOutcome, campaignStatusFrom, type ReviewDecision } from '@/lib/review/decision';
import { buildFileName, buildFinalPath, type PieceCategory } from '@/lib/onedrive/paths';
import { resolveLocalized, type AppLocale, type LocalizedText } from '@/lib/i18n/locales';
import { getCurrentPrincipal, requireStaff } from '@/lib/auth/session';

const MAX_BYTES = 15 * 1024 * 1024; // 15 Mo : pièces fiscales = petits fichiers

function extOf(filename: string): string {
  const m = filename.match(/\.([A-Za-z0-9]+)$/);
  return m ? m[1].toLowerCase() : 'bin';
}

/**
 * Dépôt d'un document par le client sur une pièce de la checklist (§7.2).
 * Stocke le fichier (temporaire chiffré en prod), lance l'analyse IA, et place la
 * pièce en file de validation humaine (MVP : HUMAIN_REQUIS, §15.1).
 */
export async function uploadDocument(formData: FormData): Promise<void> {
  const checklistItemId = String(formData.get('checklistItemId') ?? '');
  const locale = String(formData.get('locale') ?? 'fr') as AppLocale;
  const file = formData.get('file');
  if (!checklistItemId || !(file instanceof File) || file.size === 0) {
    throw new Error('Fichier ou pièce manquant.');
  }
  if (file.size > MAX_BYTES) throw new Error('Fichier trop volumineux (max 15 Mo).');

  // Authentification requise (§8). Un client ne peut déposer que sur SA campagne ;
  // un collaborateur peut déposer pour n'importe quel client.
  const principal = await getCurrentPrincipal();
  if (!principal) redirect(`/${locale}/espace`);

  const item = await prisma.checklistItem.findUnique({
    where: { id: checklistItemId },
    include: { campaign: { include: { client: true } }, pieceDefinition: true },
  });
  if (!item) throw new Error('Pièce introuvable.');

  if (principal.type === 'CLIENT' && item.campaign.clientId !== principal.client.id) {
    throw new Error('Accès refusé : cette pièce ne vous appartient pas.');
  }
  const uploadedByClient = principal.type === 'CLIENT';

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extOf(file.name);
  const tempStorageKey = await storeTemp(buffer, ext);
  const version = (await prisma.document.count({ where: { checklistItemId } })) + 1;

  const doc = await prisma.document.create({
    data: {
      checklistItemId,
      version,
      originalFilename: file.name,
      tempStorageKey,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: buffer.length,
      uploadedByClient,
      status: 'RECU',
    },
  });

  await appendAuditLog(prisma, {
    actorType: principal.type === 'CLIENT' ? 'CLIENT' : principal.user.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR',
    actorId: principal.type === 'CLIENT' ? principal.client.id : principal.user.id,
    action: 'DOCUMENT_UPLOAD',
    entityType: 'Document',
    entityId: doc.id,
    metadata: { pieceCode: item.pieceCode, filename: file.name, version },
    createdAt: new Date(),
  });

  // Extraction du texte (§7.2) : texte / PDF numérique / OCR pour scans & images.
  const extraction = await extractText(buffer, file.type, file.name);
  const text = extraction.text;

  const result = await analyzeDocument({
    pieceCode: item.pieceCode,
    pieceNom: resolveLocalized(item.pieceDefinition.nom as unknown as LocalizedText, locale),
    pieceDescription: resolveLocalized(item.pieceDefinition.description as unknown as LocalizedText, locale),
    expectedFiscalYear: item.expectedFiscalYear,
    clientDisplayName: item.campaign.client.displayName,
    acceptedFormats: item.pieceDefinition.acceptedFormats,
    clientLocale: item.campaign.client.locale.toLowerCase() as AppLocale,
    filename: file.name,
    text,
  });

  await prisma.aiVerdict.create({
    data: {
      documentId: doc.id,
      conforme: result.conforme,
      typeDetecte: result.typeDetecte,
      anneeDetectee: result.anneeDetectee,
      scoreLisibilite: result.scoreLisibilite,
      anomalies: result.anomalies as unknown as Prisma.InputJsonValue,
      messageClient: result.messageClient as unknown as Prisma.InputJsonValue,
      model: result.model,
      rawResponse: result.raw as Prisma.InputJsonValue,
    },
  });

  // MVP : toutes les pièces sont HUMAIN_REQUIS → file de validation, quel que soit
  // le verdict (§4.2/§15.1). Le routage auto viendra avec AUTO_AUTORISE + client AUTO.
  await prisma.document.update({ where: { id: doc.id }, data: { status: 'EN_VALIDATION' } });
  await prisma.checklistItem.update({ where: { id: checklistItemId }, data: { status: 'EN_VALIDATION' } });

  await appendAuditLog(prisma, {
    actorType: 'IA',
    action: 'AI_VERDICT',
    entityType: 'Document',
    entityId: doc.id,
    metadata: { conforme: result.conforme, anomalies: result.anomalies, model: result.model, extraction: extraction.method },
    createdAt: new Date(),
  });

  revalidatePath(`/${locale}/espace`); // rafraîchit la vue du client après dépôt
  revalidatePath(`/${locale}/campagne/${item.campaignId}`);
  revalidatePath(`/${locale}/validation`);
}

/**
 * Décision humaine sur un document en attente (§15.1). Enregistre la revue (avec
 * `agreedWithAi`), met à jour les statuts, dépose sur OneDrive si validé, recalcule
 * le statut de la campagne, et journalise.
 */
export async function reviewDocument(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const decision = String(formData.get('decision') ?? '') as ReviewDecision;
  const locale = String(formData.get('locale') ?? 'fr') as AppLocale;
  if (!documentId || (decision !== 'VALIDE' && decision !== 'REJETE')) {
    throw new Error('Décision invalide.');
  }

  // Validation réservée au cabinet ; le réviseur est le collaborateur CONNECTÉ
  // (donnée clé de la métrique agreedWithAi §15.3.2).
  const reviewer = await requireStaff(locale);

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      aiVerdict: true,
      checklistItem: { include: { campaign: { include: { client: true } }, pieceDefinition: true } },
    },
  });
  if (!doc || !doc.aiVerdict) throw new Error('Document ou verdict introuvable.');

  const agreed = humanAgreesWithAi(decision, doc.aiVerdict.conforme);
  const outcome = reviewOutcome(decision);
  const item = doc.checklistItem;
  const campaign = item.campaign;

  // Données de dépôt OneDrive si validé (§5.2/§5.3).
  let finalOnedrivePath: string | null = null;
  let finalFilename: string | null = null;
  let purgedAt: Date | null = null;
  let keepTempKey: string | null = doc.tempStorageKey; // conservé en démo pour l'export (§10)

  if (decision === 'VALIDE') {
    const folderParams = {
      clientCode: campaign.client.clientCode,
      clientDisplayName: campaign.client.displayName,
      fiscalYear: campaign.fiscalYear,
    };
    finalFilename = buildFileName({
      fiscalYear: campaign.fiscalYear,
      clientDisplayName: campaign.client.displayName,
      pieceCode: item.pieceCode,
      version: doc.version,
      extension: extOf(doc.originalFilename),
    });
    finalOnedrivePath = buildFinalPath(folderParams, item.category as PieceCategory, {
      fiscalYear: campaign.fiscalYear,
      clientDisplayName: campaign.client.displayName,
      pieceCode: item.pieceCode,
      version: doc.version,
      extension: extOf(doc.originalFilename),
    });

    // Dépôt réel sur OneDrive uniquement si Microsoft Graph est configuré (§5/§14.1).
    let depositedToGraph = false;
    if (process.env.MS_GRAPH_CLIENT_ID && doc.tempStorageKey) {
      try {
        const { uploadValidatedFile } = await import('@/lib/graph/client');
        const content = await readTemp(doc.tempStorageKey);
        await uploadValidatedFile(finalOnedrivePath, content, doc.mimeType);
        depositedToGraph = true;
      } catch (e) {
        console.warn('Dépôt OneDrive ignoré (Graph non configuré ou erreur):', (e as Error).message);
      }
    }
    // On ne purge le fichier temporaire QUE s'il est bien déposé sur OneDrive (§9).
    // En mode démo (sans Graph), on le conserve pour permettre l'export ZIP (§10).
    if (depositedToGraph && doc.tempStorageKey) {
      await purgeTemp(doc.tempStorageKey);
      purgedAt = new Date();
      keepTempKey = null;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.humanReview.create({
      data: { documentId, reviewerId: reviewer.id, decision, agreedWithAi: agreed },
    });
    await tx.document.update({
      where: { id: documentId },
      data: { status: outcome.documentStatus, finalOnedrivePath, finalFilename, purgedAt, tempStorageKey: keepTempKey },
    });
    await tx.checklistItem.update({ where: { id: item.id }, data: { status: outcome.itemStatus } });

    // Recalcul du statut de campagne (§11).
    const siblings = await tx.checklistItem.findMany({ where: { campaignId: campaign.id } });
    const requiredStatuses = siblings.filter((s) => s.required).map((s) => s.status as string);
    const anyInValidation = siblings.some((s) => s.status === 'EN_VALIDATION');
    const status = campaignStatusFrom(requiredStatuses, anyInValidation);
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status, completedAt: status === 'COMPLET' ? new Date() : null },
    });
  });

  await appendAuditLog(prisma, {
    actorType: reviewer.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR',
    actorId: reviewer.id,
    action: decision === 'VALIDE' ? 'REVIEW_VALIDATE' : 'REVIEW_REJECT',
    entityType: 'Document',
    entityId: documentId,
    metadata: { pieceCode: item.pieceCode, agreedWithAi: agreed, aiConforme: doc.aiVerdict.conforme, finalOnedrivePath },
    createdAt: new Date(),
  });

  revalidatePath(`/${locale}/campagne/${campaign.id}`);
  revalidatePath(`/${locale}/validation`);
}
