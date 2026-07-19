-- AlterTable
ALTER TABLE "public"."EventInteraction" ADD COLUMN     "liked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "likedAt" TIMESTAMP(3);

