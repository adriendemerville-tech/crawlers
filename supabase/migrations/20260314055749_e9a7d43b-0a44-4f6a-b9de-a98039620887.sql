-- GA4 History Log: weekly engagement snapshots (mirrors gsc_history_log)
CREATE TABLE public.ga4_history_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  week_start_date text NOT NULL,
  sessions integer NOT NULL DEFAULT 0,
  total_users integer NOT NULL DEFAULT 0,
  engagement_rate numeric NOT NULL DEFAULT 0,
  bounce_rate numeric NOT NULL DEFAULT 0,
  avg_session_duration numeric NOT NULL DEFAULT 0,
  pageviews integer NOT NULL DEFAULT 0,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one entry per site per week
CREATE UNIQUE INDEX idx_ga4_history_site_week ON public.ga4_history_log (tracked_site_id, week_start_date);

-- Index for time-series queries
CREATE INDEX idx_ga4_history_measured ON public.ga4_history_log (tracked_site_id, measured_at);

-- RLS
ALTER TABLE public.ga4_history_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage GA4 history"
  ON public.ga4_history_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view their own GA4 history"
  ON public.ga4_history_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add engagement correlation fields to serp_geo_correlations
ALTER TABLE public.serp_geo_correlations 
  ADD COLUMN IF NOT EXISTS pearson_engagement_vs_llm numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS spearman_engagement_vs_llm numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p_value_engagement numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS best_lag_engagement smallint DEFAULT 0;