-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "streakImageUrl" TEXT,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);
