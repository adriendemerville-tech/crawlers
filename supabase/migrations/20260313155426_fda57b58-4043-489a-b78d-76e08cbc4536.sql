
-- Shared domain data cache: centralizes LLM visibility, depth, and SERP data per domain
-- so multiple users tracking the same domain don't trigger redundant API calls.
CREATE TABLE public.domain_data_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  data_type TEXT NOT NULL, -- 'llm_visibility', 'llm_depth', 'serp_kpis'
  week_start_date TEXT, -- for weekly data like visibility
  result_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE(domain, data_type, week_start_date)
);

-- Index for fast lookups
CREATE INDEX idx_domain_data_cache_lookup ON public.domain_data_cache(domain, data_type, week_start_date);

-- Allow cleanup of expired entries
CREATE INDEX idx_domain_data_cache_expires ON public.domain_data_cache(expires_at);

-- Enable RLS
ALTER TABLE public.domain_data_cache ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (shared cache)
CREATE POLICY "Authenticated can read domain cache"
  ON public.domain_data_cache FOR SELECT
  TO authenticated
  USING (true);

-- Service role handles inserts/updates (from edge functions)
CREATE POLICY "Service role can manage domain cache"
  ON public.domain_data_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
