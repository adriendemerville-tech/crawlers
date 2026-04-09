-- Content gap results table
CREATE TABLE IF NOT EXISTS public.content_gap_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  competitor_domain TEXT NOT NULL,
  keyword TEXT NOT NULL,
  search_volume INTEGER DEFAULT 0,
  difficulty INTEGER DEFAULT 0,
  competitor_position INTEGER DEFAULT 0,
  our_position INTEGER,
  gap_type TEXT NOT NULL DEFAULT 'missing', -- missing | weak | opportunity
  intent TEXT,
  opportunity_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_gap_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content gap results"
  ON public.content_gap_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content gap results"
  ON public.content_gap_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own content gap results"
  ON public.content_gap_results FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_content_gap_domain ON public.content_gap_results(domain, competitor_domain);
CREATE INDEX idx_content_gap_site ON public.content_gap_results(tracked_site_id);

-- GSC daily positions for daily anomaly detection
CREATE TABLE IF NOT EXISTS public.gsc_daily_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  query TEXT NOT NULL,
  position NUMERIC NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  date_val DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tracked_site_id, query, date_val)
);

ALTER TABLE public.gsc_daily_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily positions"
  ON public.gsc_daily_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert daily positions"
  ON public.gsc_daily_positions FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_gsc_daily_site_date ON public.gsc_daily_positions(tracked_site_id, date_val DESC);
CREATE INDEX idx_gsc_daily_query ON public.gsc_daily_positions(tracked_site_id, query, date_val DESC);

-- Add email_alert_sent flag to anomaly_alerts
ALTER TABLE public.anomaly_alerts ADD COLUMN IF NOT EXISTS email_alert_sent BOOLEAN DEFAULT false;