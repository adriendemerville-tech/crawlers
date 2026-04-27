
CREATE TABLE public.ga4_traffic_sources_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  page_paths_hash TEXT NOT NULL DEFAULT '',
  page_paths TEXT[] NOT NULL DEFAULT '{}',
  sources_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '6 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tracked_site_id, period_start, period_end, page_paths_hash)
);

CREATE INDEX idx_ga4_traffic_sources_cache_lookup
  ON public.ga4_traffic_sources_cache (tracked_site_id, period_start, period_end, page_paths_hash);
CREATE INDEX idx_ga4_traffic_sources_cache_expires
  ON public.ga4_traffic_sources_cache (expires_at);

ALTER TABLE public.ga4_traffic_sources_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own GA4 traffic cache"
  ON public.ga4_traffic_sources_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own GA4 traffic cache"
  ON public.ga4_traffic_sources_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own GA4 traffic cache"
  ON public.ga4_traffic_sources_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own GA4 traffic cache"
  ON public.ga4_traffic_sources_cache FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access ga4_traffic_cache"
  ON public.ga4_traffic_sources_cache
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_ga4_traffic_sources_cache_updated_at
  BEFORE UPDATE ON public.ga4_traffic_sources_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
