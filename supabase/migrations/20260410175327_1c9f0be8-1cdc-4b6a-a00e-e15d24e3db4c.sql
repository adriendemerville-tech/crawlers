
-- Table to store GA4 behavioral metrics per page (scroll, clicks, conversions)
CREATE TABLE public.ga4_behavioral_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  page_path TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  -- Engagement metrics
  avg_engagement_time NUMERIC DEFAULT 0,
  engaged_sessions INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  -- Scroll depth (from GA4 scroll event - fires at 90% by default)
  scroll_events INTEGER DEFAULT 0,
  scroll_rate NUMERIC DEFAULT 0,
  -- Click events  
  click_events INTEGER DEFAULT 0,
  outbound_clicks INTEGER DEFAULT 0,
  -- Conversion events
  conversions INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  form_submissions INTEGER DEFAULT 0,
  -- Additional context
  exit_rate NUMERIC DEFAULT 0,
  entries INTEGER DEFAULT 0,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tracked_site_id, page_path, period_start, period_end)
);

-- RLS
ALTER TABLE public.ga4_behavioral_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own behavioral metrics"
  ON public.ga4_behavioral_metrics FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage behavioral metrics"
  ON public.ga4_behavioral_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups by page
CREATE INDEX idx_ga4_behavioral_page ON public.ga4_behavioral_metrics(tracked_site_id, page_path);
