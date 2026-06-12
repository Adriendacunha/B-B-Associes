-- CreateEnum
CREATE TYPE "ClientDeclaration" AS ENUM ('NON', 'OUI', 'NON_CONCERNE');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "clientDeclaration" "ClientDeclaration",
ADD COLUMN     "clientDeclarationAt" TIMESTAMP(3);
