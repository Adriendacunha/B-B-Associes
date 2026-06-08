'use server';

import { revalidatePath } from 'next/cache';
import type { EmailTemplateKey } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sendEmail, loadTemplate } from '@/lib/email/mailer';
import { buildEmailVars, renderEmail, pendingPieces } from '@/lib/email/compose';
import { clientLink, formatDate, missingItems, loadCampaignContext } from '@/lib/email/context';
import { runDueReminders } from '@/lib/reminders/run';
import { requireStaff } from '@/lib/auth/session';

/** Envoi de l'e-mail d'invitation + ouverture de la campagne (§6, J0). */
export async function sendInvitation(formData: FormData): Promise<void> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const uiLocale = String(formData.get('locale') ?? 'fr');
  await requireStaff(uiLocale);
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
  await requireStaff(uiLocale);
  const c = await loadCampaignContext(campaignId);
  if (!c) throw new Error('Campagne introuvable.');

  if (pendingPieces(c.checklistItems).length === 0) {
    revalidatePath(`/${uiLocale}/campagne/${campaignId}`);
    return;
  }

  const priorReminders = await prisma.emailMessage.count({ where: { campaignId, templateKey: { in: RELANCE_SEQUENCE } } });
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
 * Déclenche le moteur de relances automatiques (§6.1). Le même code est exécuté
 * par le cron d'exploitation (app/api/cron/reminders).
 */
export async function processDueReminders(formData: FormData): Promise<void> {
  const uiLocale = String(formData.get('locale') ?? 'fr');
  await requireStaff(uiLocale);
  await runDueReminders();
  revalidatePath(`/${uiLocale}/tableau-de-bord`);
  revalidatePath(`/${uiLocale}/emails`);
}
