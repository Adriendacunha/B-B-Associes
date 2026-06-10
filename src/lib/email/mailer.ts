// Envoi d'e-mails (§6.2). En production : Microsoft Graph `sendMail` depuis la
// boîte partagée du cabinet. En démo (Graph non configuré) : l'e-mail est consigné
// dans la boîte d'envoi interne (« Éléments envoyés »). Chaque envoi est journalisé.

import type { EmailTemplateKey, Locale } from '@prisma/client';
import { prisma } from '@/lib/db';
import { appendAuditLog } from '@/lib/audit/log';

export interface SendEmailInput {
  campaignId?: string | null;
  to: string;
  locale: Locale;
  templateKey?: EmailTemplateKey | null;
  subject: string;
  body: string;
  actorId?: string | null;
}

/**
 * L'envoi e-mail réel (Microsoft Graph) requiert l'authentification applicative
 * (tenant/client/secret) ET l'adresse expéditrice. Sans l'un de ces éléments, on
 * reste en mode démo (journalisation) — on évite ainsi les échecs silencieux.
 * Le drive OneDrive n'est PAS requis pour envoyer un e-mail.
 */
function graphConfigured(): boolean {
  return Boolean(
    process.env.MS_GRAPH_CLIENT_ID &&
      process.env.MS_GRAPH_TENANT_ID &&
      process.env.MS_GRAPH_CLIENT_SECRET &&
      process.env.MS_GRAPH_SENDER_ADDRESS,
  );
}

/**
 * Indique si un canal d'envoi réel est actif (vs mode démo). Utilisé par l'UI
 * pour signaler au cabinet si les e-mails partent réellement.
 */
export function isRealEmailChannel(): boolean {
  return graphConfigured();
}

export async function sendEmail(input: SendEmailInput) {
  let status: 'SENT' | 'LOGGED' | 'FAILED' = 'LOGGED';
  let channel = 'demo-outbox';
  let error: string | null = null;

  if (graphConfigured()) {
    channel = 'graph';
    try {
      const { sendMail } = await import('@/lib/graph/client');
      await sendMail({ to: input.to, subject: input.subject, body: input.body });
      status = 'SENT';
    } catch (e) {
      status = 'FAILED';
      error = (e as Error).message;
    }
  }

  const msg = await prisma.emailMessage.create({
    data: {
      campaignId: input.campaignId ?? null,
      recipient: input.to,
      locale: input.locale,
      templateKey: input.templateKey ?? null,
      subject: input.subject,
      body: input.body,
      status,
      channel,
      error,
    },
  });

  await appendAuditLog(prisma, {
    actorType: 'SYSTEM',
    actorId: input.actorId ?? null,
    action: 'EMAIL_SENT',
    entityType: 'EmailMessage',
    entityId: msg.id,
    metadata: { to: input.to, templateKey: input.templateKey ?? null, status, channel },
    createdAt: new Date(),
  });

  return msg;
}

/** Charge un gabarit dans la langue demandée, avec repli sur le français (§3). */
export async function loadTemplate(key: EmailTemplateKey, locale: Locale) {
  const tpl =
    (await prisma.emailTemplate.findUnique({ where: { key_locale: { key, locale } } })) ??
    (await prisma.emailTemplate.findUnique({ where: { key_locale: { key, locale: 'FR' } } }));
  if (!tpl) throw new Error(`Gabarit e-mail introuvable: ${key}/${locale}`);
  return tpl;
}
