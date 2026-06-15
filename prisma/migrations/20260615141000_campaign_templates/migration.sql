-- CreateEnum
CREATE TYPE "CampaignEngine" AS ENUM ('PROFILAGE_TAGS', 'QUESTIONNAIRE', 'CUSTOM');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "canton" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "CampaignTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "engine" "CampaignEngine" NOT NULL DEFAULT 'CUSTOM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTemplate_key_key" ON "CampaignTemplate"("key");
