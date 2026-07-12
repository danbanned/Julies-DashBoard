-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "eventStartDate" TEXT,
    "eventEndDate" TEXT,
    "eventUrl" TEXT,
    "location" TEXT,
    "neighborhood" TEXT,
    "source" TEXT,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "attendedAt" TIMESTAMP(3),
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3),
    "addedToCalendar" BOOLEAN NOT NULL DEFAULT false,
    "addedToCalendarAt" TIMESTAMP(3),
    "calendarEventId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3),
    "posted" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "earned" BOOLEAN NOT NULL DEFAULT false,
    "earnedAt" TIMESTAMP(3),
    "progress" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventInteraction_userId_saved_idx" ON "EventInteraction"("userId", "saved");

-- CreateIndex
CREATE INDEX "EventInteraction_userId_attended_idx" ON "EventInteraction"("userId", "attended");

-- CreateIndex
CREATE UNIQUE INDEX "EventInteraction_userId_eventId_key" ON "EventInteraction"("userId", "eventId");

-- CreateIndex
CREATE INDEX "Achievement_userId_weekStart_idx" ON "Achievement"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_userId_key_weekStart_key" ON "Achievement"("userId", "key", "weekStart");

-- AddForeignKey
ALTER TABLE "EventInteraction" ADD CONSTRAINT "EventInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
