// Canal d'envoi e-mail SMTP (§6.2) — alternative simple à Microsoft Graph pour
// TESTER les workflows de relance depuis une boîte Gmail / Google Workspace (ou
// tout serveur SMTP). Idéal pour un bêta côté Google Workspace, sans dépendre de
// l'app registration Azure du cabinet.
//
// Configuration (voir .env.example) :
//   SMTP_HOST="smtp.gmail.com"
//   SMTP_PORT="465"        # 465 = SSL ; 587 = STARTTLS
//   SMTP_USER="vous@votredomaine.ch"
//   SMTP_PASSWORD="<mot de passe d'application Google>"
//   SMTP_FROM="B&B Associés <vous@votredomaine.ch>"  # défaut : SMTP_USER

import nodemailer from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
}

function loadSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST ?? '';
  const user = process.env.SMTP_USER ?? '';
  const password = process.env.SMTP_PASSWORD ?? '';
  if (!host || !user || !password) {
    throw new Error('SMTP non configuré (SMTP_HOST / SMTP_USER / SMTP_PASSWORD requis). Voir .env.example.');
  }
  const port = Number(process.env.SMTP_PORT ?? '465');
  // `secure: true` pour le port 465 (SSL implicite) ; STARTTLS sinon (587).
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  return { host, port, user, password, secure, from: process.env.SMTP_FROM || user };
}

export async function sendMailSmtp(params: { to: string; subject: string; body: string; cc?: string[] }): Promise<void> {
  const cfg = loadSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password },
  });
  await transporter.sendMail({
    from: cfg.from,
    to: params.to,
    cc: params.cc,
    subject: params.subject,
    text: params.body,
  });
}
