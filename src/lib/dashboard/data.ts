// Agrégats RÉELS du tableau de bord (§11) et métriques MVP (§15.3), calculés
// depuis la base. Remplace les données de démonstration.

import { prisma } from '@/lib/db';
import { completude, autonomyCompletionRate, reliabilityByPiece, timeSaved } from '@/lib/metrics/mvp';
import { planCadence, nextReminder, type CadenceRule } from '@/lib/reminders/cadence';

const BASELINE_REMINDERS_PER_CAMPAIGN = 4; // hypothèse historique (relances manuelles)

export interface DashboardClientRow {
  clientCode: string;
  displayName: string;
  manager: string;
  completude: { ratio: number; label: string };
  status: string;
  nextReminderDays: number | null;
  clientDeclaration: 'NON' | 'OUI' | 'NON_CONCERNE' | null;
}

export async function getDashboardData() {
  const now = new Date();

  const [rules, campaigns, reviews, emailsSent] = await Promise.all([
    prisma.reminderRule.findMany({ where: { active: true }, orderBy: { stepOrder: 'asc' } }),
    prisma.campaign.findMany({
      include: {
        client: { include: { gestionnaire: true } },
        checklistItems: true,
        reminders: { include: { rule: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.humanReview.findMany({ include: { document: { include: { checklistItem: true } } } }),
    prisma.emailMessage.count(),
  ]);

  const cadence: CadenceRule[] = rules
    .filter((r) => r.templateKey !== 'INVITATION')
    .map((r) => ({ stepOrder: r.stepOrder, label: r.label, offsetDays: r.offsetDays, action: r.action, templateKey: r.templateKey, active: r.active }));

  // Corrections humaines par campagne (verdict IA infirmé) — pour l'autonomie (§15.3.1).
  const correctionsByCampaign = new Map<string, number>();
  for (const r of reviews) {
    if (!r.agreedWithAi) {
      const cid = r.document.checklistItem.campaignId;
      correctionsByCampaign.set(cid, (correctionsByCampaign.get(cid) ?? 0) + 1);
    }
  }

  const clients: DashboardClientRow[] = [];
  const autonomyInput: { isComplete: boolean; humanCorrections: number; manualReminders: number; escalations: number }[] = [];
  let remindersSent = 0;

  for (const c of campaigns) {
    const required = c.checklistItems.filter((i) => i.required);
    const comp = completude({ requiredTotal: required.length, conformes: required.filter((i) => i.status === 'CONFORME').length });
    const isComplete = c.status === 'COMPLET';

    const sentSteps = c.reminders.filter((r) => r.sentAt).map((r) => r.rule.stepOrder);
    const escalations = c.reminders.filter((r) => r.rule.action === 'ESCALADE_INTERNE' && r.sentAt).length;
    remindersSent += c.reminders.filter((r) => r.sentAt).length;

    let nextReminderDays: number | null = null;
    if (c.openedAt && !isComplete && !c.remindersPaused) {
      const next = nextReminder(planCadence(c.openedAt, cadence), sentSteps, now, { remindersPaused: c.remindersPaused, isComplete });
      if (next) nextReminderDays = Math.max(0, Math.round((next.scheduledFor.getTime() - now.getTime()) / 86_400_000));
    }

    clients.push({
      clientCode: c.client.clientCode,
      displayName: c.client.displayName,
      manager: c.client.gestionnaire?.name ?? '—',
      completude: comp,
      status: c.status,
      nextReminderDays,
      clientDeclaration: c.clientDeclaration,
    });

    autonomyInput.push({
      isComplete,
      humanCorrections: correctionsByCampaign.get(c.id) ?? 0,
      manualReminders: c.reminders.filter((r) => r.sentAt).length,
      escalations,
    });
  }

  const reliability = reliabilityByPiece(
    reviews.map((r) => ({ pieceCode: r.document.checklistItem.pieceCode, agreedWithAi: r.agreedWithAi })),
    0.9,
    20,
  );
  const overallReliability =
    reviews.length === 0 ? 0 : reviews.filter((r) => r.agreedWithAi).length / reviews.length;

  const saved = timeSaved({
    baselineManualRemindersPerCampaign: BASELINE_REMINDERS_PER_CAMPAIGN,
    campaigns: campaigns.length,
    actualManualReminders: remindersSent,
  });

  return {
    clients,
    totalCampaigns: campaigns.length,
    completeCount: campaigns.filter((c) => c.status === 'COMPLET').length,
    autonomyRate: autonomyCompletionRate(autonomyInput),
    overallReliability,
    reliabilityByPiece: reliability,
    remindersSent,
    emailsSent,
    minutesSaved: saved.minutesSaved,
  };
}
