-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "emailIsReal" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "partners" TEXT,
    "clientType" TEXT NOT NULL DEFAULT 'RENTER',
    "source" TEXT NOT NULL DEFAULT 'FORM',
    "neighborhoods" TEXT[],
    "moveMonth" TIMESTAMP(3),
    "creditBand" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "proofOfIncome" BOOLEAN,
    "whoLiving" TEXT,
    "outOfState" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "specificProperty" TEXT,
    "maxRent" INTEGER,
    "bedroomsMin" INTEGER,
    "bedroomsRaw" TEXT,
    "pets" BOOLEAN NOT NULL DEFAULT false,
    "budget" INTEGER,
    "financing" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "takingOn" BOOLEAN,
    "contactedRaw" TEXT,
    "lastReachedOut" TIMESTAMP(3),
    "followUpDue" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "formKey" TEXT,
    "rawSource" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientNote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3),
    "reminded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ClientToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ClientToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_formKey_key" ON "Client"("formKey");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "CrmNotification_read_idx" ON "CrmNotification"("read");

-- CreateIndex
CREATE INDEX "CrmNotification_createdAt_idx" ON "CrmNotification"("createdAt");

-- CreateIndex
CREATE INDEX "_ClientToTag_B_index" ON "_ClientToTag"("B");

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmNotification" ADD CONSTRAINT "CrmNotification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientToTag" ADD CONSTRAINT "_ClientToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientToTag" ADD CONSTRAINT "_ClientToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
