-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lockEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockPasswordHash" TEXT;
