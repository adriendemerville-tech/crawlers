
-- Table for daily GA4 time series metrics
CREATE TABLE public.ga4_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  sessions INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  revenue NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tracked_site_id, metric_date)
);

CREATE INDEX idx_ga4_daily_site_date ON public.ga4_daily_metrics(tracked_site_id, metric_date DESC);

ALTER TABLE public.ga4_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own GA4 daily metrics"
  ON public.ga4_daily_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own GA4 daily metrics"
  ON public.ga4_daily_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own GA4 daily metrics"
  ON public.ga4_daily_metrics FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do everything (edge functions use service client)
CREATE POLICY "Service role full access ga4_daily"
  ON public.ga4_daily_metrics FOR ALL
  USING (true)
  WITH CHECK (true);

-- Table for top pages with engagement data
CREATE TABLE public.ga4_top_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  page_path TEXT NOT NULL,
  pageviews INTEGER DEFAULT 0,
  avg_duration NUMERIC(10,2) DEFAULT 0,
  bounce_rate NUMERIC(5,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tracked_site_id, period_start, period_end, page_path)
);

CREATE INDEX idx_ga4_top_pages_site ON public.ga4_top_pages(tracked_site_id, period_start DESC);

ALTER TABLE public.ga4_top_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own GA4 top pages"
  ON public.ga4_top_pages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own GA4 top pages"
  ON public.ga4_top_pages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own GA4 top pages"
  ON public.ga4_top_pages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access ga4_top_pages"
  ON public.ga4_top_pages FOR ALL
  USING (true)
  WITH CHECK (true);
