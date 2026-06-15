-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN     "internalNote" TEXT,
ADD COLUMN     "clientNote" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3);
