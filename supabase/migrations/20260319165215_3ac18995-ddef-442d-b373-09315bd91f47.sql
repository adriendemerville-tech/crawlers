
-- Revenue source enum
CREATE TYPE public.revenue_source AS ENUM ('ga4', 'shopify', 'woocommerce', 'webflow', 'wix', 'drupal');

-- Core revenue events table
CREATE TABLE public.revenue_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source revenue_source NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  transaction_date TIMESTAMPTZ NOT NULL,
  order_external_id TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for ML pipeline queries (Sg x T x a = R)
CREATE INDEX idx_revenue_events_site_date ON public.revenue_events (tracked_site_id, transaction_date);
CREATE INDEX idx_revenue_events_user ON public.revenue_events (user_id);
CREATE INDEX idx_revenue_events_source ON public.revenue_events (source);

-- Unique constraint to prevent duplicate webhook deliveries
CREATE UNIQUE INDEX idx_revenue_events_dedup ON public.revenue_events (tracked_site_id, source, order_external_id) WHERE order_external_id IS NOT NULL;

-- RLS
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own revenue events"
  ON public.revenue_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert revenue events"
  ON public.revenue_events FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can view all revenue events"
  ON public.revenue_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Aggregate view for impact engine & ML pipeline
-- Provides weekly revenue bucketed by site, joinable with ga4_history_log, gsc_history_log, ias_history
CREATE OR REPLACE VIEW public.revenue_weekly_summary AS
SELECT
  tracked_site_id,
  user_id,
  date_trunc('week', transaction_date)::date AS week_start_date,
  source,
  currency,
  SUM(amount) AS total_revenue,
  COUNT(*) AS transaction_count,
  AVG(amount) AS avg_order_value
FROM public.revenue_events
GROUP BY tracked_site_id, user_id, date_trunc('week', transaction_date), source, currency;

-- Function for impact engine: get revenue between two dates for a site
CREATE OR REPLACE FUNCTION public.get_site_revenue(
  p_tracked_site_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE(total_revenue NUMERIC, transaction_count BIGINT, avg_order_value NUMERIC, currency TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(amount), 0) AS total_revenue,
    COUNT(*) AS transaction_count,
    COALESCE(AVG(amount), 0) AS avg_order_value,
    COALESCE(MAX(currency), 'EUR') AS currency
  FROM public.revenue_events
  WHERE tracked_site_id = p_tracked_site_id
    AND transaction_date >= p_start_date
    AND transaction_date <= p_end_date;
$$;
