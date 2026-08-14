-- Fix sender_profiles table to match schema.prisma
-- Add missing confidence column and fix bidirectional_interactions -> bidirectional_count

ALTER TABLE "sender_profiles" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- If bidirectional_interactions exists, rename it to bidirectional_count
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='sender_profiles' AND column_name='bidirectional_interactions'
  ) THEN
    ALTER TABLE "sender_profiles" RENAME COLUMN "bidirectional_interactions" TO "bidirectional_count";
  END IF;
END
$$;

-- Ensure bidirectional_count exists if not already there
ALTER TABLE "sender_profiles" ADD COLUMN IF NOT EXISTS "bidirectional_count" INTEGER NOT NULL DEFAULT 0;
