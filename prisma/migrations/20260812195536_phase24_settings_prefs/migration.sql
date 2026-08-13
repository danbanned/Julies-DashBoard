-- AlterTable
ALTER TABLE "User" ADD COLUMN     "layoutPref" TEXT NOT NULL DEFAULT 'column',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "seasonPref" TEXT NOT NULL DEFAULT 'off',
ADD COLUMN     "themePref" TEXT NOT NULL DEFAULT 'original';
