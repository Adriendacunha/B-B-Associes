// Seed de la base : référentiel de pièces, cadence de relance, modèles d'e-mails,
// paramètres, + quelques données de démonstration (admin, collaborateur, clients
// bêta-testeurs conformes au §15.2 : particuliers salariés résidents suisses).
//
// Usage : npm run db:seed  (nécessite DATABASE_URL et une base migrée).

import { PrismaClient, Prisma } from '@prisma/client';
import { PIECE_REFERENTIAL } from '../src/data/piece-referential';
import { rectificativePieceEntries } from '../src/data/templates/rectificative-pieces';
import { CAMPAIGN_TEMPLATES } from '../src/data/campaign-templates';
import { DEFAULT_EMAIL_TEMPLATES } from '../src/data/email-templates';
import { DEFAULT_CADENCE } from '../src/lib/reminders/cadence';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function seedPieces() {
  const allPieces = [...PIECE_REFERENTIAL, ...rectificativePieceEntries()];
  for (const p of allPieces) {
    await prisma.pieceDefinition.upsert({
      where: { code: p.code },
      update: {
        category: p.category,
        profils: p.profils,
        requiredByDefault: p.requiredByDefault,
        modeValidation: p.modeValidation,
        acceptedFormats: p.acceptedFormats,
        expectedYearOffset: p.expectedYearOffset,
        nom: p.nom as Prisma.InputJsonValue,
        description: p.description as Prisma.InputJsonValue,
        texteAide: p.texteAide as Prisma.InputJsonValue,
      },
      create: {
        code: p.code,
        category: p.category,
        profils: p.profils,
        requiredByDefault: p.requiredByDefault,
        modeValidation: p.modeValidation,
        acceptedFormats: p.acceptedFormats,
        expectedYearOffset: p.expectedYearOffset,
        nom: p.nom as Prisma.InputJsonValue,
        description: p.description as Prisma.InputJsonValue,
        texteAide: p.texteAide as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`✓ ${allPieces.length} pièces (référentiel + template rectificative)`);
}

async function seedCadence() {
  for (const r of DEFAULT_CADENCE) {
    await prisma.reminderRule.upsert({
      where: { stepOrder: r.stepOrder },
      update: { label: r.label, offsetDays: r.offsetDays, action: r.action, templateKey: r.templateKey as any, active: r.active },
      create: { label: r.label, stepOrder: r.stepOrder, offsetDays: r.offsetDays, action: r.action, templateKey: r.templateKey as any, active: r.active },
    });
  }
  console.log(`✓ ${DEFAULT_CADENCE.length} règles de cadence (§6.1)`);
}

async function seedEmailTemplates() {
  for (const t of DEFAULT_EMAIL_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { key_locale: { key: t.key, locale: t.locale.toUpperCase() as any } },
      update: { subject: t.subject, body: t.body },
      create: { key: t.key, locale: t.locale.toUpperCase() as any, subject: t.subject, body: t.body },
    });
  }
  console.log(`✓ ${DEFAULT_EMAIL_TEMPLATES.length} modèles d'e-mails (3 langues)`);
}

async function seedSettings() {
  await prisma.setting.upsert({
    where: { key: 'ai_auto_reliability_threshold' },
    update: { value: 0.9 },
    create: { key: 'ai_auto_reliability_threshold', value: 0.9 },
  });
  await prisma.setting.upsert({
    where: { key: 'send_window' },
    update: { value: { hourUtc: 7, businessDaysOnly: true } },
    create: { key: 'send_window', value: { hourUtc: 7, businessDaysOnly: true } },
  });
  console.log('✓ paramètres globaux (seuil §15.4, fenêtre d’envoi §6.1)');
}

async function seedDemo() {
  // Mots de passe du cabinet : configurables par variables d'environnement
  // (à définir en production — le dépôt est public). Défauts pour le dev local.
  const adminPlain = process.env.ADMIN_PASSWORD ?? 'changeme-admin';
  const collabPlain = process.env.COLLAB_PASSWORD ?? 'changeme-collab';
  const adminPass = await hashPassword(adminPlain);
  const collabPass = await hashPassword(collabPlain);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bbassocies.ch' },
    // Réinitialise le mot de passe ET déverrouille à chaque (re)déploiement.
    update: { passwordHash: adminPass, failedLoginCount: 0, lockedUntil: null },
    create: { email: 'admin@bbassocies.ch', name: 'Associé Admin', passwordHash: adminPass, role: 'ADMIN' },
  });
  const collab = await prisma.user.upsert({
    where: { email: 'collab@bbassocies.ch' },
    update: { passwordHash: collabPass, failedLoginCount: 0, lockedUntil: null },
    create: { email: 'collab@bbassocies.ch', name: 'Collaborateur Référent', passwordHash: collabPass, role: 'COLLABORATEUR' },
  });

  // Bêta-testeurs (§15.2) : particuliers salariés résidents suisses, profils simples.
  const betaClients = [
    { clientCode: 'C0001', displayName: 'Dupont Jean', email: 'jean.dupont@example.ch', logement: 'LOCATAIRE' as const },
    { clientCode: 'C0002', displayName: 'Müller Anna', email: 'anna.muller@example.ch', logement: 'PROPRIETAIRE' as const },
  ];

  // Mot de passe démo pour permettre la connexion immédiate (à changer en prod).
  const clientPass = await hashPassword('changeme-client');
  for (const c of betaClients) {
    const client = await prisma.client.upsert({
      where: { clientCode: c.clientCode },
      update: { passwordHash: clientPass, emailVerified: new Date() },
      create: {
        clientCode: c.clientCode,
        displayName: c.displayName,
        type: 'PARTICULIER',
        email: c.email,
        locale: 'FR',
        residence: 'RESIDENT_CH',
        niveauDeService: 'EXPERT', // MVP : tous en expert (§2/§15)
        gestionnaireId: collab.id,
        passwordHash: clientPass,
        emailVerified: new Date(),
      },
    });
    console.log(`  • client bêta ${client.clientCode} - ${client.displayName} (gestionnaire: ${collab.name})`);
  }

  const pwNote = (envVar: string, def: string) =>
    process.env[envVar] ? '(défini par variable d’environnement)' : def;
  console.log('✓ démo — identifiants de connexion :');
  console.log(`   cabinet  : admin@bbassocies.ch / ${pwNote('ADMIN_PASSWORD', 'changeme-admin')}   ·   collab@bbassocies.ch / ${pwNote('COLLAB_PASSWORD', 'changeme-collab')}`);
  console.log('   clients  : jean.dupont@example.ch / changeme-client   ·   anna.muller@example.ch / changeme-client');
}

async function seedCampaignTemplates() {
  for (const t of CAMPAIGN_TEMPLATES) {
    await prisma.campaignTemplate.upsert({
      where: { key: t.key },
      update: { name: t.name, description: t.description, engine: t.engine, sortOrder: t.sortOrder },
      create: { key: t.key, name: t.name, description: t.description, engine: t.engine, active: t.active, sortOrder: t.sortOrder },
    });
  }
  console.log(`✓ ${CAMPAIGN_TEMPLATES.length} modèles de campagne`);
}

async function main() {
  console.log('Seed B&B Associés…');
  await seedPieces();
  await seedCampaignTemplates();
  await seedCadence();
  await seedEmailTemplates();
  await seedSettings();
  await seedDemo();
  console.log('Seed terminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
