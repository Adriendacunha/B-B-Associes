// Moteur de relance automatique (§6.1), réutilisable par l'action manuelle du
// tableau de bord ET par le cron d'exploitation (app/api/cron/reminders).
//
// Respecte les règles du brief : arrêt si dossier complet, suspension manuelle,
// ciblage des seules pièces en attente, cadence configurable (ReminderRule).

import { prisma } from '@/lib/db';
import { sendEmail, loadTemplate } from '@/lib/email/mailer';
import { buildEmailVars, renderEmail, pendingPieces } from '@/lib/email/compose';
import { clientLink, formatDate, missingItems } from '@/lib/email/context';
import { planCadence, dueReminders, type CadenceRule } from '@/lib/reminders/cadence';

export interface RunResult {
  campaignsScanned: number;
  remindersSent: number;
}

export async function runDueReminders(now: Date = new Date()): Promise<RunResult> {
  const rules = await prisma.reminderRule.findMany({ where: { active: true }, orderBy: { stepOrder: 'asc' } });
  const cadence: CadenceRule[] = rules
    .filter((r) => r.templateKey !== 'INVITATION') // l'invitation est envoyée explicitement
    .map((r) => ({ stepOrder: r.stepOrder, label: r.label, offsetDays: r.offsetDays, action: r.action, templateKey: r.templateKey, active: r.active }));
  const ruleByStep = new Map(rules.map((r) => [r.stepOrder, r]));
  const ruleIdToStep = new Map(rules.map((r) => [r.id, r.stepOrder]));

  const campaigns = await prisma.campaign.findMany({
    where: { status: { notIn: ['COMPLET', 'NON_COMMENCE', 'SUSPENDU'] }, remindersPaused: false, openedAt: { not: null } },
    include: { client: { include: { gestionnaire: true } }, checklistItems: { include: { pieceDefinition: true } }, reminders: true },
  });

  let remindersSent = 0;

  for (const c of campaigns) {
    // Le client a déclaré avoir terminé (ou ne pas être concerné) : on cesse de
    // le relancer automatiquement (UX §7). La relance manuelle reste possible.
    if (c.clientDeclaration === 'OUI' || c.clientDeclaration === 'NON_CONCERNE') continue;
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
      remindersSent += 1;
    }
  }

  return { campaignsScanned: campaigns.length, remindersSent };
}
