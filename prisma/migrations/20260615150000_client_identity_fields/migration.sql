-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "civilStatus" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "permitType" TEXT,
ADD COLUMN     "avsNumber" TEXT,
ADD COLUMN     "religion" TEXT;
