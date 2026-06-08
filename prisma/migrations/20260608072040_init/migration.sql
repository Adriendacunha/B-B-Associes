-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'COLLABORATEUR');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('SOCIETE', 'INDEPENDANT', 'PARTICULIER', 'HOIRIE');

-- CreateEnum
CREATE TYPE "NiveauDeService" AS ENUM ('EXPERT', 'AUTO');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('FR', 'EN', 'DE');

-- CreateEnum
CREATE TYPE "ResidenceStatus" AS ENUM ('RESIDENT_CH', 'FRONTALIER', 'QUASI_RESIDENT');

-- CreateEnum
CREATE TYPE "PieceCategory" AS ENUM ('REVENUS', 'TITRES_FORTUNE', 'IMMOBILIER', 'DEDUCTIONS', 'FAMILLE', 'INDEP_SOCIETE', 'A_TRIER');

-- CreateEnum
CREATE TYPE "ModeValidation" AS ENUM ('HUMAIN_REQUIS', 'AUTO_AUTORISE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('NON_COMMENCE', 'EN_COURS', 'EN_ATTENTE_CLIENT', 'A_VALIDER', 'COMPLET', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('MANQUANT', 'DEPOSE', 'EN_VALIDATION', 'CONFORME', 'NON_CONFORME');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('RECU', 'ANALYSE_IA', 'EN_VALIDATION', 'VALIDE', 'REJETE', 'DEPOSE_ONEDRIVE', 'PURGE');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('CLIENT', 'COLLABORATEUR', 'ADMIN', 'IA', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReminderAction" AS ENUM ('EMAIL_CLIENT', 'ESCALADE_INTERNE');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PLANIFIE', 'ENVOYE', 'ANNULE');

-- CreateEnum
CREATE TYPE "EmailTemplateKey" AS ENUM ('INVITATION', 'RELANCE_1', 'RELANCE_2', 'RELANCE_3', 'ESCALADE_INTERNE', 'ACCUSE_RECEPTION', 'NON_CONFORMITE', 'DOSSIER_COMPLET');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'COLLABORATEUR',
    "locale" "Locale" NOT NULL DEFAULT 'FR',
    "totpSecret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "ClientType" NOT NULL,
    "email" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'FR',
    "residence" "ResidenceStatus" NOT NULL DEFAULT 'RESIDENT_CH',
    "niveauDeService" "NiveauDeService" NOT NULL DEFAULT 'EXPERT',
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "activationToken" TEXT,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "gestionnaireId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PieceDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "PieceCategory" NOT NULL,
    "profils" TEXT[],
    "requiredByDefault" BOOLEAN NOT NULL DEFAULT true,
    "modeValidation" "ModeValidation" NOT NULL DEFAULT 'HUMAIN_REQUIS',
    "acceptedFormats" TEXT[] DEFAULT ARRAY['pdf', 'jpg', 'png']::TEXT[],
    "expectedYearOffset" INTEGER NOT NULL DEFAULT 0,
    "nom" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "texteAide" JSONB NOT NULL,
    "exampleDocUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PieceDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'NON_COMMENCE',
    "profile" JSONB NOT NULL,
    "dueDate" TIMESTAMP(3),
    "remindersPaused" BOOLEAN NOT NULL DEFAULT false,
    "onedriveFolder" TEXT,
    "openedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "pieceDefinitionId" TEXT NOT NULL,
    "pieceCode" TEXT NOT NULL,
    "category" "PieceCategory" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "expectedFiscalYear" INTEGER NOT NULL,
    "modeValidation" "ModeValidation" NOT NULL DEFAULT 'HUMAIN_REQUIS',
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'MANQUANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originalFilename" TEXT NOT NULL,
    "tempStorageKey" TEXT,
    "finalOnedrivePath" TEXT,
    "finalFilename" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByClient" BOOLEAN NOT NULL DEFAULT true,
    "status" "DocumentStatus" NOT NULL DEFAULT 'RECU',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiVerdict" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "conforme" BOOLEAN NOT NULL,
    "typeDetecte" TEXT,
    "anneeDetectee" INTEGER,
    "scoreLisibilite" DOUBLE PRECISION,
    "anomalies" JSONB NOT NULL DEFAULT '[]',
    "messageClient" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanReview" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "agreedWithAi" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HumanReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "action" "ReminderAction" NOT NULL DEFAULT 'EMAIL_CLIENT',
    "templateKey" "EmailTemplateKey" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "ReminderStatus" NOT NULL DEFAULT 'PLANIFIE',
    "targetedPieceCodes" TEXT[],

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "key" "EmailTemplateKey" NOT NULL,
    "locale" "Locale" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientCode_key" ON "Client"("clientCode");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_activationToken_key" ON "Client"("activationToken");

-- CreateIndex
CREATE UNIQUE INDEX "PieceDefinition_code_key" ON "PieceDefinition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_clientId_fiscalYear_key" ON "Campaign"("clientId", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_campaignId_pieceDefinitionId_key" ON "ChecklistItem"("campaignId", "pieceDefinitionId");

-- CreateIndex
CREATE INDEX "Document_checklistItemId_idx" ON "Document"("checklistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "AiVerdict_documentId_key" ON "AiVerdict"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "HumanReview_documentId_key" ON "HumanReview"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderRule_stepOrder_key" ON "ReminderRule"("stepOrder");

-- CreateIndex
CREATE INDEX "Reminder_campaignId_status_idx" ON "Reminder"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_key_locale_key" ON "EmailTemplate"("key", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_hash_key" ON "AuditLog"("hash");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_pieceDefinitionId_fkey" FOREIGN KEY ("pieceDefinitionId") REFERENCES "PieceDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiVerdict" ADD CONSTRAINT "AiVerdict_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReminderRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
