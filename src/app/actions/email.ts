'use server';

import { revalidatePath } from 'next/cache';
import type { EmailTemplateKey, Locale } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sendEmail, loadTemplate } from '@/lib/email/mailer';
import { buildEmailVars, renderEmail, formatMissingPieces, pendingPieces } from '@/lib/email/compose';
import { planCadence, dueReminders, type CadenceRule } from '@/lib/reminders/cadence';
import type { LocalizedText } from '@/lib/i18n/locales';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

async function loadCampaignContext(campaignId: string) {
  return prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      client: { include: { gestionnaire: true } },
      checklistItems: { include: { pieceDefinition: true } },
    },
  });
}

function clientLink(locale: Locale): string {
  return `${APP_URL}/${locale.toLowerCase()}/espace`;
}

function missingItems(items: { status: string; pieceDefinition: { nom: unknown } }[], locale: Locale) {
  const mapped = items.map((i) => ({ status: i.status, nom: i.pieceDefinition.nom as unknown as LocalizedText }));
  return formatMissingPieces(mapped, locale.toLowerCase() as 'fr' | 'en' | 'de');
}

/** Envoi de l'e-mail d'invitation + ouverture de la campagne (§6, J0). */
export async function sendInvitation(formData: FormData): Promise<void> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const uiLocale = String(formData.get('locale') ?? 'fr');
  const c = await loadCampaignContext(campaignId);
  if (!c) throw new Error('Campagne introuvable.');

  const tpl = await loadTemplate('INVITATION', c.client.locale);
  const vars = buildEmailVars({
    clientName: c.client.displayName,
    link: clientLink(c.client.locale),
    dueDate: formatDate(c.dueDate),
    managerName: c.client.gestionnaire?.name,
  });
  const { subject, body } = renderEmail(tpl, vars);
  await sendEmail({ campaignId, to: c.client.email, locale: c.client.locale, templateKey: 'INVITATION', subject, body });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { openedAt: c.openedAt ?? new Date(), status: c.status === 'NON_COMMENCE' ? 'EN_ATTENTE_CLIENT' : c.status },
  });

  revalidatePath(`/${uiLocale}/campagne/${campaignId}`);
  revalidatePath(`/${uiLocale}/emails`);
}

const RELANCE_SEQUENCE: EmailTemplateKey[] = ['RELANCE_1', 'RELANCE_2', 'RELANCE_3'];

/** Relance MANUELLE (Phase 1) sur les pièces manquantes/non conformes (§6.1). */
export async function sendReminderNow(formData: FormData): Promise<void> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const uiLocale = String(formData.get('locale') ?? 'fr');
  const c = await loadCampaignContext(campaignId);
  if (!c) throw new Error('Campagne introuvable.');

  // Pas de relance si plus rien n'est en attente (arrêt automatique, §6.1).
  if (pendingPieces(c.checklistItems).length === 0) {
    revalidatePath(`/${uiLocale}/campagne/${campaignId}`);
    return;
  }

  // Choix du palier de relance selon le nombre déjà envoyé.
  const priorReminders = await prisma.emailMessage.count({
    where: { campaignId, templateKey: { in: RELANCE_SEQUENCE } },
  });
  const key = RELANCE_SEQUENCE[Math.min(priorReminders, RELANCE_SEQUENCE.length - 1)];

  const tpl = await loadTemplate(key, c.client.locale);
  const vars = buildEmailVars({
    clientName: c.client.displayName,
    missingPieces: missingItems(c.checklistItems, c.client.locale),
    link: clientLink(c.client.locale),
    dueDate: formatDate(c.dueDate),
    managerName: c.client.gestionnaire?.name,
  });
  const { subject, body } = renderEmail(tpl, vars);
  await sendEmail({ campaignId, to: c.client.email, locale: c.client.locale, templateKey: key, subject, body });

  revalidatePath(`/${uiLocale}/campagne/${campaignId}`);
  revalidatePath(`/${uiLocale}/emails`);
}

/**
 * Traite les relances DUES pour toutes les campagnes (moteur automatique §6.1).
 * Démontrable manuellement ici ; en production, à déclencher par un cron
 * (ex. Vercel Cron) appelant cette logique. Respecte : arrêt si complet,
 * suspension manuelle, et ne cible que les pièces en attente.
 */
export async function processDueReminders(formData: FormData): Promise<void> {
  const uiLocale = String(formData.get('locale') ?? 'fr');
  const now = new Date();

  const rules = await prisma.reminderRule.findMany({ where: { active: true }, orderBy: { stepOrder: 'asc' } });
  // On exclut l'invitation (envoyée explicitement) du moteur de relance.
  const cadence: CadenceRule[] = rules
    .filter((r) => r.templateKey !== 'INVITATION')
    .map((r) => ({ stepOrder: r.stepOrder, label: r.label, offsetDays: r.offsetDays, action: r.action, templateKey: r.templateKey, active: r.active }));
  const ruleByStep = new Map(rules.map((r) => [r.stepOrder, r]));
  const ruleIdToStep = new Map(rules.map((r) => [r.id, r.stepOrder]));

  const campaigns = await prisma.campaign.findMany({
    where: { status: { notIn: ['COMPLET', 'NON_COMMENCE', 'SUSPENDU'] }, remindersPaused: false, openedAt: { not: null } },
    include: { client: { include: { gestionnaire: true } }, checklistItems: { include: { pieceDefinition: true } }, reminders: true },
  });

  for (const c of campaigns) {
    const required = c.checklistItems.filter((i) => i.required);
    const isComplete = required.length > 0 && required.every((i) => i.status === 'CONFORME');
    const planned = planCadence(c.openedAt!, cadence);
    const sentSteps = c.reminders
      .filter((r) => r.sentAt)
      .map((r) => ruleIdToStep.get(r.ruleId))
      .filter((s): s is number => s !== undefined);
    const due = dueReminders(planned, sentSteps, now, { remindersPaused: c.remindersPaused, isComplete });

    for (const step of due) {
      const rule = ruleByStep.get(step.stepOrder);
      if (!rule) continue;
      const missing = missingItems(c.checklistItems, c.client.locale);
      if (step.action === 'ESCALADE_INTERNE') {
        const to = c.client.gestionnaire?.email;
        if (!to) continue;
        const tpl = await loadTemplate('ESCALADE_INTERNE', 'FR');
        const vars = buildEmailVars({ clientName: c.client.displayName, missingPieces: missing, dueDate: formatDate(c.dueDate), managerName: c.client.gestionnaire?.name });
        const { subject, body } = renderEmail(tpl, vars);
        await sendEmail({ campaignId: c.id, to, locale: 'FR', templateKey: 'ESCALADE_INTERNE', subject, body });
      } else {
        const tpl = await loadTemplate(rule.templateKey, c.client.locale);
        const vars = buildEmailVars({ clientName: c.client.displayName, missingPieces: missing, link: clientLink(c.client.locale), dueDate: formatDate(c.dueDate), managerName: c.client.gestionnaire?.name });
        const { subject, body } = renderEmail(tpl, vars);
        await sendEmail({ campaignId: c.id, to: c.client.email, locale: c.client.locale, templateKey: rule.templateKey, subject, body });
      }
      await prisma.reminder.create({
        data: { campaignId: c.id, ruleId: rule.id, scheduledFor: step.scheduledFor, sentAt: now, status: 'ENVOYE', targetedPieceCodes: pendingPieces(c.checklistItems).map((i) => i.pieceCode) },
      });
    }
  }

  revalidatePath(`/${uiLocale}/tableau-de-bord`);
  revalidatePath(`/${uiLocale}/emails`);
}
