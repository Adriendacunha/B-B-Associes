'use server';

import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/session';
import { appendAuditLog } from '@/lib/audit/log';

const LOCALES = new Set(['FR', 'EN', 'DE']);
const TYPES = new Set(['PARTICULIER', 'INDEPENDANT', 'SOCIETE', 'HOIRIE']);
const RESIDENCES = new Set(['RESIDENT_CH', 'FRONTALIER', 'QUASI_RESIDENT']);

/**
 * Création d'un client (bêta-testeur, §15.2) par le cabinet. Génère un jeton
 * d'activation ; le compte définira son mot de passe via le lien d'activation.
 */
export async function createClient(formData: FormData): Promise<void> {
  const uiLocale = String(formData.get('uiLocale') ?? 'fr');
  const staff = await requireStaff(uiLocale);

  const clientCode = String(formData.get('clientCode') ?? '').trim();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const locale = String(formData.get('locale') ?? 'FR').toUpperCase();
  const type = String(formData.get('type') ?? 'PARTICULIER');
  const residence = String(formData.get('residence') ?? 'RESIDENT_CH');
  const canton = String(formData.get('canton') ?? '').trim() || null;
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const gestionnaireId = String(formData.get('gestionnaireId') ?? '').trim() || staff.id;

  if (!clientCode || !displayName || !email) redirect(`/${uiLocale}/clients?error=champs`);
  if (!LOCALES.has(locale) || !TYPES.has(type) || !RESIDENCES.has(residence)) {
    redirect(`/${uiLocale}/clients?error=valeurs`);
  }

  const activationToken = randomBytes(24).toString('base64url');

  try {
    const client = await prisma.client.create({
      data: {
        clientCode,
        displayName,
        email,
        locale: locale as Prisma.ClientCreateInput['locale'],
        type: type as Prisma.ClientCreateInput['type'],
        residence: residence as Prisma.ClientCreateInput['residence'],
        canton,
        phone,
        niveauDeService: 'EXPERT', // MVP : tous en expert (§2/§15)
        gestionnaireId,
        activationToken,
      },
    });
    await appendAuditLog(prisma, {
      actorType: staff.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR',
      actorId: staff.id,
      action: 'CLIENT_CREATED',
      entityType: 'Client',
      entityId: client.id,
      metadata: { clientCode, email },
      createdAt: new Date(),
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      redirect(`/${uiLocale}/clients?error=existe`); // code ou e-mail déjà utilisé
    }
    throw e;
  }

  redirect(`/${uiLocale}/clients?created=${clientCode}`);
}
