-- CreateTable
CREATE TABLE "PlaybookPillar" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📌',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlaybookPillar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookSection" (
    "id" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "coverImage" TEXT,
    "neighborhoods" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookBlock" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "emoji" TEXT,
    "heading" TEXT NOT NULL,
    "body" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlaybookBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookCallout" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlaybookCallout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaybookPillar_key_key" ON "PlaybookPillar"("key");

-- AddForeignKey
ALTER TABLE "PlaybookSection" ADD CONSTRAINT "PlaybookSection_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "PlaybookPillar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookBlock" ADD CONSTRAINT "PlaybookBlock_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PlaybookSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookCallout" ADD CONSTRAINT "PlaybookCallout_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PlaybookBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
