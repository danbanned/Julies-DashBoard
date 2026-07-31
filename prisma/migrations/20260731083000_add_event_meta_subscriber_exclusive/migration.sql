-- 21b: subscriber-exclusive event flag.
ALTER TABLE "EventMeta" ADD COLUMN IF NOT EXISTS "subscriberExclusive" BOOLEAN NOT NULL DEFAULT false;
