
-- Google Ads weekly performance history
CREATE TABLE public.google_ads_history_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  week_start_date TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  avg_cpc_micros BIGINT DEFAULT 0,
  conversions NUMERIC DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  campaign_data JSONB DEFAULT '[]'::jsonb,
  measured_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.google_ads_history_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ads history" ON public.google_ads_history_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service can insert ads history" ON public.google_ads_history_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_google_ads_history_site ON public.google_ads_history_log(tracked_site_id, week_start_date);

-- Anomaly alerts table
CREATE TABLE public.anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_source TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  direction TEXT NOT NULL DEFAULT 'neutral',
  z_score NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  baseline_mean NUMERIC NOT NULL DEFAULT 0,
  baseline_stddev NUMERIC NOT NULL DEFAULT 0,
  change_pct NUMERIC DEFAULT 0,
  affected_pages INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  detected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.anomaly_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON public.anomaly_alerts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own alerts" ON public.anomaly_alerts
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_anomaly_alerts_site ON public.anomaly_alerts(tracked_site_id, detected_at DESC);
CREATE INDEX idx_anomaly_alerts_user ON public.anomaly_alerts(user_id, is_dismissed, detected_at DESC);
