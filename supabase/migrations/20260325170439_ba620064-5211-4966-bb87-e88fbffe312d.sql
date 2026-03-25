
-- Add seasonality columns to tracked_sites
ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS is_seasonal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS seasonality_profile jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seasonality_detected_at timestamptz;

-- Add composite IAS columns to ias_history
ALTER TABLE public.ias_history
  ADD COLUMN IF NOT EXISTS age_factor numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS seasonality_factor numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS composite_ias_score integer,
  ADD COLUMN IF NOT EXISTS founding_year integer,
  ADD COLUMN IF NOT EXISTS is_seasonal boolean DEFAULT false;

-- Add seasonality columns to ias_settings
ALTER TABLE public.ias_settings
  ADD COLUMN IF NOT EXISTS seasonality_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS age_adjustment_enabled boolean DEFAULT true;
