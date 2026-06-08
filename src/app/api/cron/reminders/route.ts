// Endpoint cron des relances automatiques (§6.1).
//
// Déclenché par Vercel Cron (voir vercel.json) selon la cadence d'exploitation.
// Vercel ajoute l'en-tête `Authorization: Bearer ${CRON_SECRET}` aux requêtes cron
// lorsque la variable `CRON_SECRET` est définie ; on la vérifie ici.

import { NextResponse } from 'next/server';
import { runDueReminders } from '@/lib/reminders/run';
import { appendAuditLog } from '@/lib/audit/log';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET non configuré' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runDueReminders();
  await appendAuditLog(prisma, {
    actorType: 'SYSTEM',
    action: 'CRON_REMINDERS',
    entityType: 'System',
    metadata: { campaignsScanned: result.campaignsScanned, remindersSent: result.remindersSent },
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true, ...result });
}
