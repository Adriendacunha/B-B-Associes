// Consultation du contenu d'un document (pour la vérification manuelle, §15.1).
// Réservé au cabinet et au client propriétaire. Renvoie le fichier déchiffré inline.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentPrincipal } from '@/lib/auth/session';
import { getDocumentContent } from '@/lib/storage/document';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const principal = await getCurrentPrincipal();
  if (!principal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { documentId } = await params;
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { checklistItem: { include: { campaign: true } } },
  });
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Un client ne peut consulter que ses propres documents.
  if (principal.type === 'CLIENT' && doc.checklistItem.campaign.clientId !== principal.client.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let content = await getDocumentContent(documentId);
  // Fallback production : si la copie locale a été purgée après dépôt, on récupère
  // le fichier validé depuis OneDrive (§5/§10).
  if (!content && doc.finalOnedrivePath && process.env.MS_GRAPH_CLIENT_ID) {
    try {
      const { downloadValidatedFile } = await import('@/lib/graph/client');
      content = await downloadValidatedFile(doc.finalOnedrivePath);
    } catch {
      content = null;
    }
  }
  if (!content) {
    return NextResponse.json({ error: 'contenu indisponible' }, { status: 404 });
  }

  return new NextResponse(content as unknown as BodyInit, {
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(doc.originalFilename)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
