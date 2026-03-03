
-- Table to track LinkedIn share clicks for anti-fraud
CREATE TABLE public.shared_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  visitor_ip TEXT NOT NULL,
  report_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_link_clicks ENABLE ROW LEVEL SECURITY;

-- Service can insert (edge function with service role)
CREATE POLICY "Service can insert clicks" ON public.shared_link_clicks
  FOR INSERT TO authenticated WITH CHECK (true);

-- Users can view their own referral clicks
CREATE POLICY "Users can view their own clicks" ON public.shared_link_clicks
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);

-- Index for anti-fraud lookups
CREATE INDEX idx_shared_link_clicks_fraud ON public.shared_link_clicks (referrer_id, visitor_ip, report_id);
CREATE INDEX idx_shared_link_clicks_daily ON public.shared_link_clicks (referrer_id, created_at);
