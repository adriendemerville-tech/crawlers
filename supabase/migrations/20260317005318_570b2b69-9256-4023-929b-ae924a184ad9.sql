ALTER TABLE public.tracked_sites 
  ADD COLUMN IF NOT EXISTS identity_confidence integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS identity_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_source text DEFAULT 'none';

COMMENT ON COLUMN public.tracked_sites.identity_confidence IS 'Confidence score 0-100 for the site identity card';
COMMENT ON COLUMN public.tracked_sites.identity_enriched_at IS 'Last time the identity card was enriched/verified';
COMMENT ON COLUMN public.tracked_sites.identity_source IS 'Source of identity data: none, llm_auto, user_manual, llm_verified';