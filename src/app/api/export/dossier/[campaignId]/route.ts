// Export d'un dossier (§10) : ZIP des pièces validées + CSV récapitulatif.
// Réservé aux collaborateurs. ?format=csv renvoie le CSV seul.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentPrincipal } from '@/lib/auth/session';
import { appendAuditLog } from '@/lib/audit/log';
import { readTemp } from '@/lib/storage/temp';
import { resolveLocalized, type AppLocale, type LocalizedText } from '@/lib/i18n/locales';
import {
  buildRecapCsv,
  buildDossierZip,
  exportBaseName,
  type RecapRow,
  type ZipFile,
} from '@/lib/export/dossier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const graphConfigured = () =>
  Boolean(process.env.MS_GRAPH_CLIENT_ID && process.env.MS_GRAPH_TENANT_ID && process.env.MS_GRAPH_CLIENT_SECRET);

export async function GET(req: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const principal = await getCurrentPrincipal();
  if (!principal || principal.type !== 'STAFF') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }

  const { campaignId } = await params;
  const url = new URL(req.url);
  const csvOnly = url.searchParams.get('format') === 'csv';
  const loc = (url.searchParams.get('locale') ?? 'fr') as AppLocale;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      client: true,
      checklistItems: {
        include: {
          pieceDefinition: true,
          documents: { orderBy: { version: 'desc' }, take: 1, include: { humanReview: true } },
        },
      },
    },
  });
  if (!campaign) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const meta = { clientCode: campaign.client.clientCode, clientName: campaign.client.displayName, fiscalYear: campaign.fiscalYear };

  const rows: RecapRow[] = campaign.checklistItems.map((item) => {
    const latest = item.documents[0];
    return {
      pieceCode: item.pieceCode,
      nom: resolveLocalized(item.pieceDefinition.nom as unknown as LocalizedText, loc),
      category: item.category,
      required: item.required,
      status: item.status,
      finalFilename: latest?.finalFilename ?? null,
      depositDate: latest?.uploadedAt ?? null,
      validationDate: latest?.humanReview?.createdAt ?? null,
    };
  });
  const csv = buildRecapCsv(meta, rows);
  const base = exportBaseName(meta);

  await appendAuditLog(prisma, {
    actorType: principal.user.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR',
    actorId: principal.user.id,
    action: csvOnly ? 'EXPORT_CSV' : 'EXPORT_DOSSIER',
    entityType: 'Campaign',
    entityId: campaignId,
    metadata: { format: csvOnly ? 'csv' : 'zip', pieces: rows.length },
    createdAt: new Date(),
  });

  if (csvOnly) {
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${base}_recapitulatif.csv"`,
      },
    });
  }

  // Contenu des pièces CONFORMES : OneDrive (prod) ou stockage temporaire conservé (démo).
  const files: ZipFile[] = [];
  for (const item of campaign.checklistItems) {
    const latest = item.documents[0];
    if (item.status !== 'CONFORME' || !latest?.finalFilename) continue;
    try {
      let content: Buffer | null = null;
      if (graphConfigured() && latest.finalOnedrivePath) {
        const { downloadValidatedFile } = await import('@/lib/graph/client');
        content = await downloadValidatedFile(latest.finalOnedrivePath);
      } else if (latest.tempStorageKey) {
        content = await readTemp(latest.tempStorageKey);
      }
      if (content) files.push({ filename: latest.finalFilename, content });
    } catch {
      // pièce non récupérable : on l'omet du ZIP (le CSV la liste tout de même)
    }
  }

  const zip = await buildDossierZip(meta, csv, files);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${base}_dossier.zip"`,
    },
  });
}
