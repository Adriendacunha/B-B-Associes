import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { runDueReminders } from './run';

// Intégration §6.1 : le moteur de relance contre une vraie base (cadence,
// idempotence, arrêt si complet, suspension). Chaque test crée sa propre campagne.

const createdClientIds: string[] = [];

async function makeCampaign(opts: { daysAgo: number; paused?: boolean; complete?: boolean }) {
  const code = 'ITEST-' + Math.random().toString(36).slice(2, 9).toUpperCase();
  const client = await prisma.client.create({
    data: { clientCode: code, displayName: 'ITest Client', type: 'PARTICULIER', email: `${code.toLowerCase()}@test.ch`, locale: 'FR' },
  });
  createdClientIds.push(client.id);
  const piece = await prisma.pieceDefinition.findFirstOrThrow();
  const campaign = await prisma.campaign.create({
    data: {
      clientId: client.id,
      fiscalYear: 2025,
      profile: {},
      status: 'EN_ATTENTE_CLIENT',
      remindersPaused: Boolean(opts.paused),
      openedAt: new Date(Date.now() - opts.daysAgo * 86_400_000),
    },
  });
  await prisma.checklistItem.create({
    data: {
      campaignId: campaign.id,
      pieceDefinitionId: piece.id,
      pieceCode: piece.code,
      category: piece.category,
      required: true,
      expectedFiscalYear: 2025,
      status: opts.complete ? 'CONFORME' : 'MANQUANT',
    },
  });
  return campaign.id;
}

const reminderCount = (campaignId: string) => prisma.reminder.count({ where: { campaignId } });

afterAll(async () => {
  for (const clientId of createdClientIds) {
    await prisma.campaign.deleteMany({ where: { clientId } }); // cascade items + reminders
    await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
  }
  await prisma.emailMessage.deleteMany({ where: { recipient: { contains: '@test.ch' } } });
});

describe('runDueReminders (intégration §6.1)', () => {
  it('envoie les paliers dus selon la cadence, puis reste idempotent', async () => {
    const id = await makeCampaign({ daysAgo: 25 });
    await runDueReminders();
    // J+25 : RELANCE_1 (J7), RELANCE_2 (J14), RELANCE_3 (J21) dus ; escalade (J28) non.
    expect(await reminderCount(id)).toBe(3);
    await runDueReminders();
    expect(await reminderCount(id)).toBe(3); // pas de doublon
  });

  it('n’envoie rien si le dossier est complet (arrêt automatique)', async () => {
    const id = await makeCampaign({ daysAgo: 25, complete: true });
    await runDueReminders();
    expect(await reminderCount(id)).toBe(0);
  });

  it('n’envoie rien si les relances sont suspendues', async () => {
    const id = await makeCampaign({ daysAgo: 25, paused: true });
    await runDueReminders();
    expect(await reminderCount(id)).toBe(0);
  });

  it('n’envoie pas encore avant le premier palier (J+3)', async () => {
    const id = await makeCampaign({ daysAgo: 3 });
    await runDueReminders();
    expect(await reminderCount(id)).toBe(0);
  });
});
