'use server';

import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/session';
import { appendAuditLog } from '@/lib/audit/log';

const LOCALES = new Set(['FR', 'EN', 'DE']);

/** Génère un code client court et unique à partir du nom (ex. BORG4821). */
async function generateClientCode(lastName: string): Promise<string> {
  const base = (lastName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4) || 'CLT').padEnd(4, 'X');
  for (let i = 0; i < 8; i++) {
    const code = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await prisma.client.findUnique({ where: { clientCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  return `C${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/**
 * Création d'un client (bêta-testeur, §15.2) par le cabinet. Génère un jeton
 * d'activation ; le compte définira son mot de passe via le lien d'activation.
 */
export async function createClient(formData: FormData): Promise<void> {
  const uiLocale = String(formData.get('uiLocale') ?? 'fr');
  const staff = await requireStaff(uiLocale);

  const lastName = String(formData.get('lastName') ?? '').trim();
  const firstName = String(formData.get('firstName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const locale = String(formData.get('locale') ?? 'FR').toUpperCase();
  const gestionnaireId = String(formData.get('gestionnaireId') ?? '').trim() || staff.id;
  const civilStatus = String(formData.get('civilStatus') ?? '').trim() || null;
  const birthRaw = String(formData.get('birthDate') ?? '').trim();
  const birthDate = birthRaw ? new Date(birthRaw) : null;
  const str = (k: string) => String(formData.get(k) ?? '').trim() || null;

  if (!lastName || !firstName || !email) redirect(`/${uiLocale}/clients?error=champs`);
  if (!LOCALES.has(locale)) redirect(`/${uiLocale}/clients?error=valeurs`);

  const displayName = `${lastName} ${firstName}`.trim();
  const clientCode = await generateClientCode(lastName);
  const activationToken = randomBytes(24).toString('base64url');

  try {
    const client = await prisma.client.create({
      data: {
        clientCode,
        displayName,
        firstName,
        lastName,
        email,
        locale: locale as Prisma.ClientCreateInput['locale'],
        type: 'PARTICULIER',
        birthDate,
        civilStatus,
        street: str('street'),
        postalCode: str('postalCode'),
        city: str('city'),
        nationality: str('nationality'),
        permitType: str('permitType'),
        avsNumber: str('avsNumber'),
        religion: str('religion'),
        phone: str('phone'),
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
