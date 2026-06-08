'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession, getCurrentPrincipal } from '@/lib/auth/session';
import { isLocked, registerFailure, resetFailures } from '@/lib/auth/lockout';
import { appendAuditLog } from '@/lib/audit/log';

const MIN_PASSWORD = 8;

/** Connexion d'un collaborateur (staff). */
export async function staffLogin(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const locale = String(formData.get('locale') ?? 'fr');
  const fail = (reason: string) => redirect(`/${locale}/login?error=${reason}`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !user.active) {
    await appendAuditLog(prisma, { actorType: 'SYSTEM', action: 'LOGIN_FAILED', entityType: 'User', metadata: { email, reason: 'unknown' }, createdAt: new Date() });
    fail('invalid');
    return;
  }
  if (isLocked(user.lockedUntil)) fail('locked');

  const staffActor = user.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR';
  if (!(await verifyPassword(password, user.passwordHash))) {
    const next = registerFailure(user.failedLoginCount);
    await prisma.user.update({ where: { id: user.id }, data: next });
    await appendAuditLog(prisma, { actorType: staffActor, actorId: user.id, action: 'LOGIN_FAILED', entityType: 'User', entityId: user.id, metadata: { attempts: next.failedLoginCount }, createdAt: new Date() });
    fail(next.lockedUntil ? 'locked' : 'invalid');
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: resetFailures() });
  await createSession('STAFF', user.id);
  await appendAuditLog(prisma, { actorType: staffActor, actorId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, metadata: { role: user.role }, createdAt: new Date() });
  redirect(`/${locale}/tableau-de-bord`);
}

/** Connexion d'un client. */
export async function clientLogin(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const locale = String(formData.get('locale') ?? 'fr');
  const fail = (reason: string) => redirect(`/${locale}/espace?error=${reason}`);

  const client = await prisma.client.findUnique({ where: { email } });
  if (!client || !client.passwordHash) {
    await appendAuditLog(prisma, { actorType: 'SYSTEM', action: 'LOGIN_FAILED', entityType: 'Client', metadata: { email, reason: 'unknown_or_inactive' }, createdAt: new Date() });
    fail('invalid');
    return;
  }
  if (isLocked(client.lockedUntil)) fail('locked');

  if (!(await verifyPassword(password, client.passwordHash))) {
    const next = registerFailure(client.failedLoginCount);
    await prisma.client.update({ where: { id: client.id }, data: next });
    await appendAuditLog(prisma, { actorType: 'CLIENT', actorId: client.id, action: 'LOGIN_FAILED', entityType: 'Client', entityId: client.id, metadata: { attempts: next.failedLoginCount }, createdAt: new Date() });
    fail(next.lockedUntil ? 'locked' : 'invalid');
    return;
  }

  await prisma.client.update({ where: { id: client.id }, data: resetFailures() });
  await createSession('CLIENT', client.id);
  await appendAuditLog(prisma, { actorType: 'CLIENT', actorId: client.id, action: 'LOGIN', entityType: 'Client', entityId: client.id, metadata: {}, createdAt: new Date() });
  redirect(`/${locale}/espace`);
}

/** Activation d'un compte client via lien (définition du mot de passe, §8). */
export async function activateClient(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const locale = String(formData.get('locale') ?? 'fr');

  if (password.length < MIN_PASSWORD) redirect(`/${locale}/activation?token=${token}&error=weak`);

  const client = await prisma.client.findFirst({ where: { activationToken: token } });
  if (!token || !client) redirect(`/${locale}/espace?error=token`);

  await prisma.client.update({
    where: { id: client!.id },
    data: { passwordHash: await hashPassword(password), emailVerified: new Date(), activationToken: null, ...resetFailures() },
  });
  await createSession('CLIENT', client!.id);
  await appendAuditLog(prisma, { actorType: 'CLIENT', actorId: client!.id, action: 'ACCOUNT_ACTIVATED', entityType: 'Client', entityId: client!.id, metadata: {}, createdAt: new Date() });
  redirect(`/${locale}/espace`);
}

/** Déconnexion (efface la session). */
export async function logout(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'fr');
  const principal = await getCurrentPrincipal();
  await destroySession();
  if (principal) {
    await appendAuditLog(prisma, {
      actorType: principal.type === 'STAFF' ? (principal.user.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR') : 'CLIENT',
      actorId: principal.type === 'STAFF' ? principal.user.id : principal.client.id,
      action: 'LOGOUT',
      entityType: principal.type === 'STAFF' ? 'User' : 'Client',
      entityId: principal.type === 'STAFF' ? principal.user.id : principal.client.id,
      metadata: {},
      createdAt: new Date(),
    });
  }
  redirect(`/${locale}`);
}
