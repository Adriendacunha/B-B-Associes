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

  const content = await getDocumentContent(documentId);
  if (!content) {
    return NextResponse.json({ error: 'contenu indisponible (purgé ou déposé sur OneDrive)' }, { status: 404 });
  }

  return new NextResponse(content as unknown as BodyInit, {
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(doc.originalFilename)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
