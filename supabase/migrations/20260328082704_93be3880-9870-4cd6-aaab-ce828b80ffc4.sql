
-- 1. Log each content generation with brief features (no prompt text, anonymizable)
CREATE TABLE public.content_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  market_sector TEXT,
  page_type TEXT NOT NULL,
  target_url TEXT,
  keyword TEXT,
  -- Brief features (deterministic, no PII)
  brief_tone TEXT,
  brief_angle TEXT,
  brief_length_target INTEGER,
  brief_h2_count INTEGER,
  brief_h3_count INTEGER,
  brief_cta_count INTEGER,
  brief_internal_links_count INTEGER,
  brief_schema_types TEXT[],
  brief_eeat_signals TEXT[],
  brief_geo_passages INTEGER,
  -- Preset used (nullable)
  preset_id UUID REFERENCES public.content_prompt_presets(id) ON DELETE SET NULL,
  preset_page_type TEXT,
  -- Source: 'content_architect' or 'parmenion'
  source TEXT NOT NULL DEFAULT 'content_architect',
  -- Performance deltas (filled later by measure-audit-impact)
  gsc_clicks_baseline NUMERIC,
  gsc_clicks_t30 NUMERIC,
  gsc_clicks_t90 NUMERIC,
  gsc_ctr_baseline NUMERIC,
  gsc_ctr_t90 NUMERIC,
  ga4_sessions_baseline NUMERIC,
  ga4_sessions_t90 NUMERIC,
  ga4_conversions_baseline NUMERIC,
  ga4_conversions_t90 NUMERIC,
  geo_score_baseline NUMERIC,
  geo_score_t90 NUMERIC,
  llm_visibility_baseline NUMERIC,
  llm_visibility_t90 NUMERIC,
  measurement_phase TEXT DEFAULT 'pending',
  measured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_generation_logs ENABLE ROW LEVEL SECURITY;

-- Service role only (backend writes, no user direct access)
CREATE POLICY "Service role full access" ON public.content_generation_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can read their own logs
CREATE POLICY "Users read own logs" ON public.content_generation_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_cgl_domain_sector ON public.content_generation_logs(domain, market_sector, page_type);
CREATE INDEX idx_cgl_measurement ON public.content_generation_logs(measurement_phase, created_at);

-- 2. Aggregated anonymous correlations (weekly snapshot)
CREATE TABLE public.content_performance_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL,
  market_sector TEXT NOT NULL,
  -- Aggregated brief features
  tone TEXT,
  angle TEXT,
  avg_length_target NUMERIC,
  avg_h2_count NUMERIC,
  avg_cta_count NUMERIC,
  avg_internal_links NUMERIC,
  avg_geo_passages NUMERIC,
  -- Aggregated performance deltas
  avg_gsc_clicks_delta NUMERIC,
  avg_gsc_ctr_delta NUMERIC,
  avg_ga4_sessions_delta NUMERIC,
  avg_ga4_conversions_delta NUMERIC,
  avg_geo_score_delta NUMERIC,
  avg_llm_visibility_delta NUMERIC,
  -- Stats
  sample_count INTEGER NOT NULL DEFAULT 0,
  confidence_grade TEXT, -- A/B/C/F
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_performance_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.content_performance_correlations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anyone authenticated can read aggregated (anonymous) data
CREATE POLICY "Authenticated read aggregated" ON public.content_performance_correlations
  FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_cpc_lookup ON public.content_performance_correlations(page_type, market_sector, week_start);
