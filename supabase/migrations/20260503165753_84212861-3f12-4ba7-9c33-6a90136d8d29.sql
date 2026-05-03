DO $$ BEGIN
  CREATE TYPE public.parmenion_throttle_period AS ENUM ('day','week');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.parmenion_targets
  ADD COLUMN IF NOT EXISTS max_content_per_period INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS throttle_period public.parmenion_throttle_period NOT NULL DEFAULT 'day';