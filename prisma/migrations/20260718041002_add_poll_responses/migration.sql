-- CreateTable
CREATE TABLE "PollResponse" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollResponse_postId_idx" ON "PollResponse"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PollResponse_postId_visitorId_key" ON "PollResponse"("postId", "visitorId");

-- AddForeignKey
ALTER TABLE "PollResponse" ADD CONSTRAINT "PollResponse_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
