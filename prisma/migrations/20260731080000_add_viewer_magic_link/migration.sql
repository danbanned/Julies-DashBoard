-- 21a: viewer magic-link login fields on User.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginTokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_loginToken_key" ON "User"("loginToken");
