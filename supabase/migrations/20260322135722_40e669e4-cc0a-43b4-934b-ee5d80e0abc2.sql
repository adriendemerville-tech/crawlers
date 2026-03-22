
-- Drop diagnostics: stores full diagnostic reports
CREATE TABLE public.drop_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  diagnosis_type text NOT NULL DEFAULT 'reactive', -- 'reactive' | 'predictive'
  drop_score integer NOT NULL DEFAULT 0, -- 0-100, severity
  drop_probability integer DEFAULT NULL, -- 0-100, prediction confidence
  period_start date NOT NULL,
  period_end date NOT NULL,
  verdict text NOT NULL DEFAULT 'unknown', -- 'trust' | 'technical' | 'content' | 'links' | 'geo' | 'mixed' | 'unknown'
  verdict_details jsonb NOT NULL DEFAULT '{}',
  gsc_data jsonb DEFAULT NULL,
  ga4_data jsonb DEFAULT NULL,
  crawl_data jsonb DEFAULT NULL,
  backlink_data jsonb DEFAULT NULL,
  eeat_geo_data jsonb DEFAULT NULL,
  technical_data jsonb DEFAULT NULL,
  affected_pages jsonb DEFAULT NULL,
  recommendations jsonb DEFAULT NULL,
  notified_user boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_drop_diagnostics_site ON public.drop_diagnostics(tracked_site_id, created_at DESC);
CREATE INDEX idx_drop_diagnostics_user ON public.drop_diagnostics(user_id, created_at DESC);

-- RLS
ALTER TABLE public.drop_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drop diagnostics"
  ON public.drop_diagnostics FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage drop diagnostics"
  ON public.drop_diagnostics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Drop detector config: admin on/off + settings
CREATE TABLE public.drop_detector_config (
  id integer PRIMARY KEY DEFAULT 1,
  is_enabled boolean NOT NULL DEFAULT false,
  run_frequency text NOT NULL DEFAULT 'daily', -- 'daily' | 'weekly'
  drop_threshold integer NOT NULL DEFAULT 15, -- % decline to trigger alert
  prediction_threshold integer NOT NULL DEFAULT 80, -- % confidence for predictive alert
  min_data_weeks integer NOT NULL DEFAULT 4, -- minimum weeks of GSC data
  cost_credits integer NOT NULL DEFAULT 3,
  last_run_at timestamptz DEFAULT NULL,
  last_run_sites_count integer DEFAULT 0,
  last_run_alerts_count integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default config
INSERT INTO public.drop_detector_config (id, is_enabled) VALUES (1, false);

-- RLS on config
ALTER TABLE public.drop_detector_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view drop detector config"
  ON public.drop_detector_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage drop detector config"
  ON public.drop_detector_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Drop detector logs: registry of all runs and alerts
CREATE TABLE public.drop_detector_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'manual' | 'predictive'
  sites_scanned integer NOT NULL DEFAULT 0,
  alerts_generated integer NOT NULL DEFAULT 0,
  diagnostics_created integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT NULL,
  duration_ms integer DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drop_detector_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view drop detector logs"
  ON public.drop_detector_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage drop detector logs"
  ON public.drop_detector_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
