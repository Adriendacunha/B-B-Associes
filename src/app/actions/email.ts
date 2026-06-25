'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EmailTemplateKey } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sendEmail, loadTemplate } from '@/lib/email/mailer';
import { buildEmailVars, renderEmail, pendingPieces } from '@/lib/email/compose';
import { clientLink, activationLink, formatDate, missingItems, loadCampaignContext } from '@/lib/email/context';
import { runDueReminders } from '@/lib/reminders/run';
import { requireStaff } from '@/lib/auth/session';

/** Cœur réutilisable : envoie l'invitation et ouvre la campagne (§6, J0). */
export async function sendInvitationFor(campaignId: string, uiLocale: string): Promise<void> {
  const c = await loadCampaignContext(campaignId);
  if (!c) throw new Error('Campagne introuvable.');

  // Un compte non activé reçoit le lien d'ACTIVATION (définition du mot de passe) ;
  // un compte déjà actif reçoit le lien vers son espace (§8/§15.2).
  const link =
    !c.client.passwordHash && c.client.activationToken
      ? activationLink(c.client.locale, c.client.activationToken)
      : clientLink(c.client.locale);
  const tpl = await loadTemplate('INVITATION', c.client.locale);
  const vars = buildEmailVars({
    clientName: c.client.displayName,
    link,
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

/** Envoi de l'e-mail d'invitation + ouverture de la campagne (§6, J0). */
export async function sendInvitation(formData: FormData): Promise<void> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const uiLocale = String(formData.get('locale') ?? 'fr');
  await requireStaff(uiLocale);
  await sendInvitationFor(campaignId, uiLocale);
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

  // Garde-fou : pas de relance dans les 24 h suivant le dernier e-mail (invitation
  // ou relance) — évite de relancer le client juste après l'invitation.
  const lastEmail = await prisma.emailMessage.findFirst({
    where: { campaignId, templateKey: { in: ['INVITATION', ...RELANCE_SEQUENCE] } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (lastEmail && Date.now() - lastEmail.createdAt.getTime() < 24 * 3600 * 1000) {
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
  const result = await runDueReminders();
  revalidatePath(`/${uiLocale}/emails`);
  redirect(`/${uiLocale}/tableau-de-bord?relancesSent=${result.remindersSent}`);
}

/**
 * Envoie un e-mail de test à une adresse donnée, pour que le cabinet vérifie la
 * délivrabilité du canal (Graph) avant d'inviter un vrai bêta-testeur. En mode
 * démo, l'e-mail est seulement consigné dans la boîte d'envoi interne.
 */
export async function sendTestEmail(formData: FormData): Promise<void> {
  const uiLocale = String(formData.get('locale') ?? 'fr');
  const staff = await requireStaff(uiLocale);
  const to = String(formData.get('to') ?? '').trim();
  if (!to) return;

  const locale = (uiLocale.toUpperCase() as 'FR' | 'EN' | 'DE') ?? 'FR';
  const subject = 'B&B Associés — e-mail de test';
  const body =
    `Ceci est un e-mail de test envoyé depuis l'espace de collecte B&B Associés.\n\n` +
    `Si vous le recevez, le canal d'envoi est correctement configuré.\n\n` +
    `— Espace de collecte documentaire`;
  await sendEmail({
    to,
    locale,
    subject,
    body,
    templateKey: null,
    actorId: staff.id,
  });

  revalidatePath(`/${uiLocale}/emails`);
}
