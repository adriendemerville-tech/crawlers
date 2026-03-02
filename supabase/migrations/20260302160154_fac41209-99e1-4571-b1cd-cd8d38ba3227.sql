
-- Add per-site API key and config storage to tracked_sites
ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS api_key uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS current_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Create unique index on api_key for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_sites_api_key ON public.tracked_sites (api_key);
