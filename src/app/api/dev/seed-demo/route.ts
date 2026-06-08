// Génération de données de DÉMONSTRATION (campagnes, verdicts, relances, e-mails)
// pour tester le process de bout en bout. Protégé par CRON_SECRET.
//
// Usage navigateur : /api/dev/seed-demo?secret=<CRON_SECRET>
// N'affecte que les clients de démo C0001 / C0002. À retirer en production.

import { NextResponse } from 'next/server';
import { generateDemoData } from '@/lib/demo/generate';
import { appendAuditLog } from '@/lib/audit/log';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET non configuré' }, { status: 503 });

  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (provided !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await generateDemoData();
  await appendAuditLog(prisma, {
    actorType: 'SYSTEM',
    action: 'DEMO_DATA_GENERATED',
    entityType: 'System',
    metadata: { campaigns: result.campaigns },
    createdAt: new Date(),
  });

  return NextResponse.json({
    ok: true,
    ...result,
    message: 'Données de démonstration générées. Rafraîchissez le tableau de bord.',
  });
}
