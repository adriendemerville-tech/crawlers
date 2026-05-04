ALTER TABLE public.site_crawls
  ADD COLUMN IF NOT EXISTS intent_distribution JSONB;

COMMENT ON COLUMN public.site_crawls.intent_distribution IS 'Compteur par intention { total, by_intent: {know,do,buy,navigate,unknown}, avg_confidence, unknown_pct }';