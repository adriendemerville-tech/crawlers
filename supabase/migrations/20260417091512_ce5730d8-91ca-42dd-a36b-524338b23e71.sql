-- Sprint 1 GEO : table de snapshot hebdomadaire des KPIs
CREATE TABLE IF NOT EXISTS public.geo_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  week_start_date DATE NOT NULL,

  -- 7 KPIs principaux du bandeau
  geo_overall_score NUMERIC,
  geo_overall_delta NUMERIC,
  citation_rate NUMERIC,
  citation_rate_delta NUMERIC,
  avg_sentiment NUMERIC,
  recommendation_rate NUMERIC,
  share_of_voice NUMERIC,
  ai_requests_per_100_visits NUMERIC,
  url_hallucination_rate NUMERIC,
  ai_referral_ctr NUMERIC,

  -- Cartes
  quotability_avg NUMERIC,
  chunkability_avg NUMERIC,
  aeo_avg NUMERIC,
  position_zero_eligible_pages INTEGER DEFAULT 0,
  fanout_coverage_avg NUMERIC,

  -- Données détaillées
  bot_traffic_mix JSONB DEFAULT '{}'::jsonb,
  cluster_coverage JSONB DEFAULT '[]'::jsonb,
  sampled_pages JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tracked_site_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_geo_kpi_site_week
  ON public.geo_kpi_snapshots (tracked_site_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_geo_kpi_user
  ON public.geo_kpi_snapshots (user_id, week_start_date DESC);

ALTER TABLE public.geo_kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own GEO KPI snapshots"
  ON public.geo_kpi_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages GEO KPI snapshots"
  ON public.geo_kpi_snapshots FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can insert their own GEO KPI snapshots"
  ON public.geo_kpi_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Colonne pour cacher la couverture Fan-Out par cluster
ALTER TABLE public.cluster_definitions
  ADD COLUMN IF NOT EXISTS fanout_coverage_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS fanout_computed_at TIMESTAMPTZ;