// Cron de purge / conservation (§9). Sécurisé par CRON_SECRET (comme les relances).
// Déclaré dans vercel.json ; en self-hosting, appeler via un cron système.

import { NextResponse } from 'next/server';
import { runRetention } from '@/lib/retention/run';
import { appendAuditLog } from '@/lib/audit/log';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET non configuré' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runRetention();
  await appendAuditLog(prisma, {
    actorType: 'SYSTEM',
    action: 'RETENTION_RUN',
    entityType: 'System',
    metadata: { scanned: result.scanned, purged: result.purged },
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true, ...result });
}
