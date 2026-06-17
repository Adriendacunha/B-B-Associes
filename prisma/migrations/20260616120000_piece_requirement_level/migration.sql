-- CreateEnum
CREATE TYPE "RequirementLevel" AS ENUM ('OBLIGATOIRE', 'SI_CONCERNE', 'OPTIONNEL');

-- AlterTable
ALTER TABLE "PieceDefinition" ADD COLUMN     "requirement" "RequirementLevel" NOT NULL DEFAULT 'SI_CONCERNE';

-- Backfill : dérive le niveau depuis requiredByDefault + profils.
UPDATE "PieceDefinition" SET "requirement" = 'OPTIONNEL' WHERE "requiredByDefault" = false;
UPDATE "PieceDefinition" SET "requirement" = 'OBLIGATOIRE'
  WHERE "requiredByDefault" = true
    AND ("profils" <@ ARRAY['PARTICULIER']::text[]);
UPDATE "PieceDefinition" SET "requirement" = 'SI_CONCERNE'
  WHERE "requiredByDefault" = true
    AND NOT ("profils" <@ ARRAY['PARTICULIER']::text[]);
