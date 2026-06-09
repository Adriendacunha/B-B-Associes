'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { putDocumentContent, getDocumentContent, clearDocumentContent } from '@/lib/storage/document';
import { analyzeDocument } from '@/lib/ai/analyze';
import { classifyDocument } from '@/lib/ai/classify';
import { extractText } from '@/lib/ocr/extract';
import { A_TRIER_CODE } from '@/data/piece-referential';
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
  // Multi-fichiers : plusieurs fichiers pour une même pièce → fusionnés en un PDF.
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  if (!checklistItemId || files.length === 0) {
    throw new Error('Fichier ou pièce manquant.');
  }
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  if (totalSize > MAX_BYTES) throw new Error('Fichier(s) trop volumineux (max 15 Mo au total).');

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

  // Remplacement : on supprime un éventuel dépôt précédent ENCORE en attente
  // (non encore tranché par un collaborateur) pour éviter les doublons.
  await prisma.document.deleteMany({
    where: { checklistItemId, status: { in: ['RECU', 'ANALYSE_IA', 'EN_VALIDATION'] } },
  });

  let buffer: Buffer;
  let mimeType: string;
  let originalFilename: string;
  if (files.length === 1) {
    buffer = Buffer.from(await files[0].arrayBuffer());
    mimeType = files[0].type || 'application/octet-stream';
    originalFilename = files[0].name;
  } else {
    const { mergeToPdf } = await import('@/lib/pdf/merge');
    const parts = await Promise.all(files.map(async (f) => ({ type: f.type, name: f.name, bytes: Buffer.from(await f.arrayBuffer()) })));
    buffer = await mergeToPdf(parts);
    mimeType = 'application/pdf';
    originalFilename = `${files[0].name.replace(/\.[^.]+$/, '')}.pdf`;
  }
  const version = (await prisma.document.count({ where: { checklistItemId } })) + 1;

  const doc = await prisma.document.create({
    data: {
      checklistItemId,
      version,
      originalFilename,
      mimeType,
      sizeBytes: buffer.length,
      uploadedByClient,
      status: 'RECU',
    },
  });
  // Contenu persistant et chiffré (remplace /tmp éphémère, §9).
  await putDocumentContent(doc.id, buffer);

  await appendAuditLog(prisma, {
    actorType: principal.type === 'CLIENT' ? 'CLIENT' : principal.user.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR',
    actorId: principal.type === 'CLIENT' ? principal.client.id : principal.user.id,
    action: 'DOCUMENT_UPLOAD',
    entityType: 'Document',
    entityId: doc.id,
    metadata: { pieceCode: item.pieceCode, filename: originalFilename, files: files.length, version },
    createdAt: new Date(),
  });

  // Extraction du texte (§7.2) : texte / PDF numérique / OCR pour scans & images.
  const extraction = await extractText(buffer, mimeType, originalFilename);
  const text = extraction.text;

  const result = await analyzeDocument({
    pieceCode: item.pieceCode,
    pieceNom: resolveLocalized(item.pieceDefinition.nom as unknown as LocalizedText, locale),
    pieceDescription: resolveLocalized(item.pieceDefinition.description as unknown as LocalizedText, locale),
    expectedFiscalYear: item.expectedFiscalYear,
    clientDisplayName: item.campaign.client.displayName,
    acceptedFormats: item.pieceDefinition.acceptedFormats,
    clientLocale: item.campaign.client.locale.toLowerCase() as AppLocale,
    filename: originalFilename,
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
    if (process.env.MS_GRAPH_CLIENT_ID) {
      try {
        const content = await getDocumentContent(documentId);
        if (content) {
          const { uploadValidatedFile } = await import('@/lib/graph/client');
          await uploadValidatedFile(finalOnedrivePath, content, doc.mimeType);
          depositedToGraph = true;
        }
      } catch (e) {
        console.warn('Dépôt OneDrive ignoré (Graph non configuré ou erreur):', (e as Error).message);
      }
    }
    // On ne purge le contenu temporaire QUE s'il est bien déposé sur OneDrive (§9).
    // En mode démo (sans Graph), on le conserve pour permettre la consultation/export (§10).
    if (depositedToGraph) {
      await clearDocumentContent(documentId);
      purgedAt = new Date();
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.humanReview.create({
      data: { documentId, reviewerId: reviewer.id, decision, agreedWithAi: agreed },
    });
    await tx.document.update({
      where: { id: documentId },
      data: { status: outcome.documentStatus, finalOnedrivePath, finalFilename, purgedAt },
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

/**
 * Renommage MANUEL d'un document (§5.3). Réservé au cabinet et au client
 * propriétaire. Si la pièce est encore en validation, relance l'analyse (le verdict
 * de démonstration dépend du nom ; avec Claude, du contenu).
 */
export async function renameDocument(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const rawName = String(formData.get('newName') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'fr') as AppLocale;
  if (!documentId || !rawName) return;

  const principal = await getCurrentPrincipal();
  if (!principal) redirect(`/${locale}/espace`);

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { checklistItem: { include: { campaign: { include: { client: true } }, pieceDefinition: true } } },
  });
  if (!doc) throw new Error('Document introuvable.');
  if (principal.type === 'CLIENT' && doc.checklistItem.campaign.clientId !== principal.client.id) {
    throw new Error('Accès refusé : ce document ne vous appartient pas.');
  }

  // Conserve l'extension d'origine si l'utilisateur ne la précise pas.
  const origExt = extOf(doc.originalFilename);
  const newName = origExt && !/\.[A-Za-z0-9]+$/.test(rawName) ? `${rawName}.${origExt}` : rawName;
  await prisma.document.update({ where: { id: documentId }, data: { originalFilename: newName } });

  await appendAuditLog(prisma, {
    actorType: principal.type === 'CLIENT' ? 'CLIENT' : principal.user.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR',
    actorId: principal.type === 'CLIENT' ? principal.client.id : principal.user.id,
    action: 'DOCUMENT_RENAMED',
    entityType: 'Document',
    entityId: documentId,
    metadata: { newName },
    createdAt: new Date(),
  });

  // Ré-analyse si la pièce est encore en file de validation.
  if (doc.status === 'EN_VALIDATION') {
    const item = doc.checklistItem;
    const content = await getDocumentContent(documentId);
    const text = content ? (await extractText(content, doc.mimeType, newName)).text : '';
    const result = await analyzeDocument({
      pieceCode: item.pieceCode,
      pieceNom: resolveLocalized(item.pieceDefinition.nom as unknown as LocalizedText, locale),
      pieceDescription: resolveLocalized(item.pieceDefinition.description as unknown as LocalizedText, locale),
      expectedFiscalYear: item.expectedFiscalYear,
      clientDisplayName: item.campaign.client.displayName,
      acceptedFormats: item.pieceDefinition.acceptedFormats,
      clientLocale: item.campaign.client.locale.toLowerCase() as AppLocale,
      filename: newName,
      text,
    });
    await prisma.aiVerdict.upsert({
      where: { documentId },
      update: {
        conforme: result.conforme,
        typeDetecte: result.typeDetecte,
        anneeDetectee: result.anneeDetectee,
        scoreLisibilite: result.scoreLisibilite,
        anomalies: result.anomalies as unknown as Prisma.InputJsonValue,
        messageClient: result.messageClient as unknown as Prisma.InputJsonValue,
        model: result.model,
        rawResponse: result.raw as Prisma.InputJsonValue,
      },
      create: {
        documentId,
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
  }

  revalidatePath(`/${locale}/espace`);
  revalidatePath(`/${locale}/campagne/${doc.checklistItem.campaignId}`);
  revalidatePath(`/${locale}/validation`);
}

/** Crée (idempotent) la pièce système « À trier » d'une campagne et renvoie son id. */
async function ensureATrierItem(campaignId: string, fiscalYear: number): Promise<string> {
  const existing = await prisma.checklistItem.findFirst({ where: { campaignId, pieceCode: A_TRIER_CODE } });
  if (existing) return existing.id;
  const def = await prisma.pieceDefinition.findUnique({ where: { code: A_TRIER_CODE } });
  if (!def) throw new Error('Pièce « À trier » absente (relancez le seed).');
  const created = await prisma.checklistItem.create({
    data: { campaignId, pieceDefinitionId: def.id, pieceCode: A_TRIER_CODE, category: 'A_TRIER', required: false, expectedFiscalYear: fiscalYear, status: 'EN_VALIDATION' },
  });
  return created.id;
}

const UNSORTED_MESSAGE = {
  fr: 'Document non classé automatiquement — à rattacher manuellement à une pièce.',
  en: 'Document not auto-sorted — to be attached manually to an item.',
  de: 'Dokument nicht automatisch sortiert — manuell einem Posten zuzuordnen.',
};

/**
 * Dépôt EN VRAC (§7) : le client dépose plusieurs documents d'un coup ; l'IA
 * identifie chacun et le range dans la bonne pièce (avec verdict). Les documents
 * non reconnus vont dans « À trier » pour classement manuel par le cabinet.
 */
export async function bulkUpload(formData: FormData): Promise<void> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const locale = String(formData.get('locale') ?? 'fr') as AppLocale;
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  if (!campaignId || files.length === 0) throw new Error('Fichiers ou campagne manquants.');

  const principal = await getCurrentPrincipal();
  if (!principal) redirect(`/${locale}/espace`);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { client: true, checklistItems: { include: { pieceDefinition: true } } },
  });
  if (!campaign) throw new Error('Campagne introuvable.');
  if (principal.type === 'CLIENT' && campaign.clientId !== principal.client.id) {
    throw new Error('Accès refusé : cette campagne ne vous appartient pas.');
  }

  const clientLocale = campaign.client.locale.toLowerCase() as AppLocale;
  const candidates = campaign.checklistItems
    .filter((i) => i.pieceCode !== A_TRIER_CODE)
    .map((i) => ({
      pieceCode: i.pieceCode,
      nom: resolveLocalized(i.pieceDefinition.nom as unknown as LocalizedText, locale),
      description: resolveLocalized(i.pieceDefinition.description as unknown as LocalizedText, locale),
    }));
  const itemByCode = new Map(campaign.checklistItems.map((i) => [i.pieceCode, i]));
  const uploadedByClient = principal.type === 'CLIENT';
  const actorType = principal.type === 'CLIENT' ? 'CLIENT' : principal.user.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR';
  const actorId = principal.type === 'CLIENT' ? principal.client.id : principal.user.id;

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractText(buffer, file.type, file.name);
    const matchedCode = await classifyDocument({ filename: file.name, text: extraction.text, candidates });
    const target = matchedCode ? itemByCode.get(matchedCode) : undefined;

    if (target) {
      await prisma.document.deleteMany({ where: { checklistItemId: target.id, status: { in: ['RECU', 'ANALYSE_IA', 'EN_VALIDATION'] } } });
      const version = (await prisma.document.count({ where: { checklistItemId: target.id } })) + 1;
      const doc = await prisma.document.create({
        data: { checklistItemId: target.id, version, originalFilename: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: buffer.length, uploadedByClient, status: 'RECU' },
      });
      await putDocumentContent(doc.id, buffer);
      const result = await analyzeDocument({
        pieceCode: target.pieceCode,
        pieceNom: resolveLocalized(target.pieceDefinition.nom as unknown as LocalizedText, clientLocale),
        pieceDescription: resolveLocalized(target.pieceDefinition.description as unknown as LocalizedText, clientLocale),
        expectedFiscalYear: target.expectedFiscalYear,
        clientDisplayName: campaign.client.displayName,
        acceptedFormats: target.pieceDefinition.acceptedFormats,
        clientLocale,
        filename: file.name,
        text: extraction.text,
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
      await prisma.document.update({ where: { id: doc.id }, data: { status: 'EN_VALIDATION' } });
      await prisma.checklistItem.update({ where: { id: target.id }, data: { status: 'EN_VALIDATION' } });
      await appendAuditLog(prisma, { actorType, actorId, action: 'BULK_UPLOAD_CLASSIFIED', entityType: 'Document', entityId: doc.id, metadata: { pieceCode: target.pieceCode, filename: file.name }, createdAt: new Date() });
    } else {
      const atrierId = await ensureATrierItem(campaignId, campaign.fiscalYear);
      const version = (await prisma.document.count({ where: { checklistItemId: atrierId } })) + 1;
      const doc = await prisma.document.create({
        data: { checklistItemId: atrierId, version, originalFilename: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: buffer.length, uploadedByClient, status: 'EN_VALIDATION' },
      });
      await putDocumentContent(doc.id, buffer);
      await prisma.aiVerdict.create({
        data: { documentId: doc.id, conforme: false, anomalies: [] as unknown as Prisma.InputJsonValue, messageClient: UNSORTED_MESSAGE as unknown as Prisma.InputJsonValue, model: 'classification', rawResponse: {} as Prisma.InputJsonValue },
      });
      await prisma.checklistItem.update({ where: { id: atrierId }, data: { status: 'EN_VALIDATION' } });
      await appendAuditLog(prisma, { actorType, actorId, action: 'BULK_UPLOAD_UNSORTED', entityType: 'Document', entityId: doc.id, metadata: { filename: file.name }, createdAt: new Date() });
    }
  }

  revalidatePath(`/${locale}/espace`);
  revalidatePath(`/${locale}/campagne/${campaignId}`);
  revalidatePath(`/${locale}/validation`);
}

/** Reclasse manuellement un document vers une autre pièce de la campagne (§7.3). */
export async function reassignDocument(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const newItemId = String(formData.get('newChecklistItemId') ?? '');
  const locale = String(formData.get('locale') ?? 'fr') as AppLocale;
  if (!documentId || !newItemId) return;
  const reviewer = await requireStaff(locale);

  const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { checklistItem: true } });
  const newItem = await prisma.checklistItem.findUnique({
    where: { id: newItemId },
    include: { pieceDefinition: true, campaign: { include: { client: true } } },
  });
  if (!doc || !newItem) throw new Error('Document ou pièce cible introuvable.');
  if (doc.checklistItem.campaignId !== newItem.campaignId) throw new Error('Pièce cible hors campagne.');

  const oldItemId = doc.checklistItemId;
  await prisma.document.deleteMany({ where: { checklistItemId: newItemId, status: { in: ['RECU', 'ANALYSE_IA', 'EN_VALIDATION'] }, id: { not: documentId } } });
  await prisma.document.update({ where: { id: documentId }, data: { checklistItemId: newItemId, status: 'EN_VALIDATION' } });

  const content = await getDocumentContent(documentId);
  const text = content ? (await extractText(content, doc.mimeType, doc.originalFilename)).text : '';
  const clientLocale = newItem.campaign.client.locale.toLowerCase() as AppLocale;
  const result = await analyzeDocument({
    pieceCode: newItem.pieceCode,
    pieceNom: resolveLocalized(newItem.pieceDefinition.nom as unknown as LocalizedText, clientLocale),
    pieceDescription: resolveLocalized(newItem.pieceDefinition.description as unknown as LocalizedText, clientLocale),
    expectedFiscalYear: newItem.expectedFiscalYear,
    clientDisplayName: newItem.campaign.client.displayName,
    acceptedFormats: newItem.pieceDefinition.acceptedFormats,
    clientLocale,
    filename: doc.originalFilename,
    text,
  });
  await prisma.aiVerdict.upsert({
    where: { documentId },
    update: { conforme: result.conforme, typeDetecte: result.typeDetecte, anneeDetectee: result.anneeDetectee, scoreLisibilite: result.scoreLisibilite, anomalies: result.anomalies as unknown as Prisma.InputJsonValue, messageClient: result.messageClient as unknown as Prisma.InputJsonValue, model: result.model, rawResponse: result.raw as Prisma.InputJsonValue },
    create: { documentId, conforme: result.conforme, typeDetecte: result.typeDetecte, anneeDetectee: result.anneeDetectee, scoreLisibilite: result.scoreLisibilite, anomalies: result.anomalies as unknown as Prisma.InputJsonValue, messageClient: result.messageClient as unknown as Prisma.InputJsonValue, model: result.model, rawResponse: result.raw as Prisma.InputJsonValue },
  });

  await prisma.checklistItem.update({ where: { id: newItemId }, data: { status: 'EN_VALIDATION' } });
  const oldPending = await prisma.document.count({ where: { checklistItemId: oldItemId, status: { in: ['RECU', 'ANALYSE_IA', 'EN_VALIDATION'] } } });
  const oldItem = await prisma.checklistItem.findUnique({ where: { id: oldItemId } });
  if (oldItem && oldItem.status !== 'CONFORME' && oldPending === 0) {
    await prisma.checklistItem.update({ where: { id: oldItemId }, data: { status: 'MANQUANT' } });
  }

  await appendAuditLog(prisma, { actorType: reviewer.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR', actorId: reviewer.id, action: 'DOCUMENT_REASSIGNED', entityType: 'Document', entityId: documentId, metadata: { from: doc.checklistItem.pieceCode, to: newItem.pieceCode }, createdAt: new Date() });

  revalidatePath(`/${locale}/validation`);
  revalidatePath(`/${locale}/campagne/${newItem.campaignId}`);
  revalidatePath(`/${locale}/espace`);
}
