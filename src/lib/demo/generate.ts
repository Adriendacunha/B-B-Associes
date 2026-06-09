// Générateur de données de DÉMONSTRATION pour tester le process de bout en bout.
// N'opère QUE sur les clients de démo (C0001, C0002) : campagnes, pièces dans
// divers états, verdicts IA, revues humaines, relances et e-mails. Idempotent.
//
// Déclenché via /api/dev/seed-demo (protégé par CRON_SECRET). À retirer en prod.

import { prisma } from '@/lib/db';
import { selectRequiredPieces, type ClientProfile } from '@/lib/checklist/profiling';
import { buildFileName } from '@/lib/onedrive/paths';
import { putDocumentContent } from '@/lib/storage/document';
import type { LocalizedText } from '@/lib/i18n/locales';
import type { Prisma } from '@prisma/client';

type Status = 'MANQUANT' | 'DEPOSE' | 'EN_VALIDATION' | 'CONFORME' | 'NON_CONFORME';

const msg = (s: string): LocalizedText => ({ fr: s, en: s, de: s });

/** PDF minimal de démonstration (consultable depuis la file de validation). */
function demoPdf(label: string): Buffer {
  const content = `BT /F1 16 Tf 60 740 Td (${label.replace(/[()]/g, '')}) Tj ET`;
  const objs = [
    `<</Type/Catalog/Pages 2 0 R>>`,
    `<</Type/Pages/Kids[3 0 R]/Count 1>>`,
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>`,
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    `<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>`,
  ];
  let pdf = `%PDF-1.4\n`;
  objs.forEach((o, i) => (pdf += `${i + 1} 0 obj\n${o}\nendobj\n`));
  pdf += `trailer<</Root 1 0 R/Size ${objs.length + 1}>>\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

interface ItemPlan {
  status: Status;
  conforme?: boolean; // verdict IA
  anomalies?: string[];
  review?: { decision: 'VALIDE' | 'REJETE'; agreedWithAi: boolean };
}

const FY = 2025;

const PROFILE_DUPONT: ClientProfile = {
  type: 'PARTICULIER', residence: 'RESIDENT_CH', revenuSalarie: true, logement: 'LOCATAIRE',
  pilier3a: true, titres: true, nbEnfants: 1, fraisGarde: true,
};
const PROFILE_MULLER: ClientProfile = {
  type: 'PARTICULIER', residence: 'RESIDENT_CH', revenuSalarie: true, logement: 'PROPRIETAIRE',
  pilier3a: true, titres: true,
};

/** États par pièce pour Dupont (C0001) — dossier en cours, mix réaliste. */
const DUPONT_PLAN: Record<string, ItemPlan> = {
  'CERT-SALAIRE': { status: 'CONFORME', conforme: true, review: { decision: 'VALIDE', agreedWithAi: true } },
  '3A': { status: 'CONFORME', conforme: true, review: { decision: 'VALIDE', agreedWithAi: true } },
  'LAMAL': { status: 'EN_VALIDATION', conforme: true },
  'ETAT-TITRES': { status: 'EN_VALIDATION', conforme: false, anomalies: ['mauvaise_annee'] },
  // Le collaborateur a infirmé le verdict IA ici (donnée de fiabilité < 100%, §15.3.2).
  'RELEVE-BANCAIRE': { status: 'NON_CONFORME', conforme: false, anomalies: ['illisible'], review: { decision: 'REJETE', agreedWithAi: false } },
};

async function clearClientDemo(clientId: string, email: string) {
  await prisma.campaign.deleteMany({ where: { clientId } }); // cascade items/docs/verdicts/reviews/reminders
  await prisma.emailMessage.deleteMany({ where: { recipient: email } });
}

interface BuildCtx {
  clientId: string;
  clientCode: string;
  clientName: string;
  reviewerId: string;
}

async function createItemArtifacts(
  ctx: BuildCtx,
  checklistItemId: string,
  pieceCode: string,
  plan: ItemPlan,
) {
  if (!plan.conforme && plan.status === 'MANQUANT') return;
  const finalFilename =
    plan.status === 'CONFORME'
      ? buildFileName({ fiscalYear: FY, clientDisplayName: ctx.clientName, pieceCode, depositDate: new Date() })
      : null;

  const doc = await prisma.document.create({
    data: {
      checklistItemId,
      version: 1,
      originalFilename: `${pieceCode.toLowerCase()}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 12345,
      uploadedByClient: true,
      status: plan.status === 'CONFORME' ? 'DEPOSE_ONEDRIVE' : plan.status === 'NON_CONFORME' ? 'REJETE' : 'EN_VALIDATION',
      finalFilename,
      uploadedAt: new Date(Date.now() - 3 * 86_400_000),
    },
  });
  // Contenu de démonstration consultable (sauf pièces purgées après dépôt).
  await putDocumentContent(doc.id, demoPdf(`${pieceCode} — ${ctx.clientName} (demonstration)`));

  await prisma.aiVerdict.create({
    data: {
      documentId: doc.id,
      conforme: Boolean(plan.conforme),
      typeDetecte: plan.conforme ? pieceCode : null,
      anneeDetectee: plan.anomalies?.includes('mauvaise_annee') ? 2023 : FY,
      scoreLisibilite: plan.anomalies?.includes('illisible') ? 0.4 : 0.95,
      anomalies: (plan.anomalies ?? []) as unknown as Prisma.InputJsonValue,
      messageClient: msg(plan.conforme ? 'Document reçu et conforme.' : 'Document non conforme, merci de corriger.') as unknown as Prisma.InputJsonValue,
      model: 'stub-demo',
      rawResponse: { demo: true } as Prisma.InputJsonValue,
    },
  });

  if (plan.review) {
    await prisma.humanReview.create({
      data: { documentId: doc.id, reviewerId: ctx.reviewerId, decision: plan.review.decision, agreedWithAi: plan.review.agreedWithAi },
    });
  }
}

async function buildCampaign(
  ctx: BuildCtx,
  profile: ClientProfile,
  plan: Record<string, ItemPlan>,
  opts: { complete?: boolean; openedDaysAgo: number },
) {
  const defs = await prisma.pieceDefinition.findMany({ where: { active: true } });
  const required = selectRequiredPieces(defs, profile);

  const campaign = await prisma.campaign.create({
    data: {
      clientId: ctx.clientId,
      fiscalYear: FY,
      profile: profile as unknown as Prisma.InputJsonValue,
      status: opts.complete ? 'COMPLET' : 'A_VALIDER',
      openedAt: new Date(Date.now() - opts.openedDaysAgo * 86_400_000),
      dueDate: new Date(Date.UTC(FY + 1, 2, 31)),
      completedAt: opts.complete ? new Date() : null,
    },
  });

  for (const def of required) {
    const itemPlan: ItemPlan = opts.complete
      ? { status: 'CONFORME', conforme: true, review: { decision: 'VALIDE', agreedWithAi: true } }
      : plan[def.code] ?? { status: 'MANQUANT' };

    const item = await prisma.checklistItem.create({
      data: {
        campaignId: campaign.id,
        pieceDefinitionId: def.id,
        pieceCode: def.code,
        category: def.category as Prisma.ChecklistItemCreateManyInput['category'],
        required: def.requiredByDefault,
        expectedFiscalYear: FY + def.expectedYearOffset,
        status: itemPlan.status,
      },
    });
    await createItemArtifacts(ctx, item.id, def.code, itemPlan);
  }

  return campaign;
}

export interface DemoResult {
  campaigns: number;
  details: string[];
}

export async function generateDemoData(): Promise<DemoResult> {
  const collab = await prisma.user.findFirst({ where: { email: 'collab@bbassocies.ch' } });
  const reviewer = collab ?? (await prisma.user.findFirst());
  if (!reviewer) throw new Error('Aucun collaborateur (lancez d’abord le seed).');

  const details: string[] = [];
  let campaigns = 0;

  const dupont = await prisma.client.findUnique({ where: { clientCode: 'C0001' } });
  if (dupont) {
    await clearClientDemo(dupont.id, dupont.email);
    const ctx: BuildCtx = { clientId: dupont.id, clientCode: 'C0001', clientName: dupont.displayName, reviewerId: reviewer.id };
    const camp = await buildCampaign(ctx, PROFILE_DUPONT, DUPONT_PLAN, { openedDaysAgo: 12 });
    // une relance déjà envoyée + e-mails dans la boîte d'envoi
    const rule = await prisma.reminderRule.findFirst({ where: { templateKey: 'RELANCE_1' } });
    if (rule) {
      await prisma.reminder.create({ data: { campaignId: camp.id, ruleId: rule.id, scheduledFor: new Date(Date.now() - 5 * 86_400_000), sentAt: new Date(Date.now() - 5 * 86_400_000), status: 'ENVOYE', targetedPieceCodes: ['LAMAL', 'ETAT-TITRES'] } });
    }
    await prisma.emailMessage.createMany({
      data: [
        { campaignId: camp.id, recipient: dupont.email, locale: 'FR', templateKey: 'INVITATION', subject: 'Votre espace de collecte', body: 'Invitation…', status: 'LOGGED', channel: 'demo-outbox', createdAt: new Date(Date.now() - 12 * 86_400_000) },
        { campaignId: camp.id, recipient: dupont.email, locale: 'FR', templateKey: 'RELANCE_1', subject: 'Rappel — pièces manquantes', body: 'Relance…', status: 'LOGGED', channel: 'demo-outbox', createdAt: new Date(Date.now() - 5 * 86_400_000) },
      ],
    });
    campaigns += 1;
    details.push('C0001 Dupont Jean — dossier en cours (2 conformes, 2 en validation, 1 à refournir), 1 relance, 2 e-mails');
  }

  const muller = await prisma.client.findUnique({ where: { clientCode: 'C0002' } });
  if (muller) {
    await clearClientDemo(muller.id, muller.email);
    const ctx: BuildCtx = { clientId: muller.id, clientCode: 'C0002', clientName: muller.displayName, reviewerId: reviewer.id };
    await buildCampaign(ctx, PROFILE_MULLER, {}, { complete: true, openedDaysAgo: 20 });
    await prisma.emailMessage.create({ data: { recipient: muller.email, locale: 'FR', templateKey: 'DOSSIER_COMPLET', subject: 'Dossier complet — merci', body: 'Merci…', status: 'LOGGED', channel: 'demo-outbox' } });
    campaigns += 1;
    details.push('C0002 Müller Anna — dossier COMPLET (toutes pièces conformes)');
  }

  return { campaigns, details };
}
