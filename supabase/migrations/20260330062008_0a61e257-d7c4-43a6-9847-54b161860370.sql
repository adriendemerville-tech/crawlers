
-- Add script hash tracking and last verification columns to site_script_rules
ALTER TABLE public.site_script_rules 
  ADD COLUMN IF NOT EXISTS expected_script_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_verification_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_failures_count INTEGER DEFAULT 0;

-- Create injection_monitor_log table for tracking periodic checks
CREATE TABLE IF NOT EXISTS public.injection_monitor_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE NOT NULL,
  rule_id UUID NOT NULL,
  domain TEXT NOT NULL,
  url_checked TEXT NOT NULL,
  expected_hash TEXT,
  detected_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ok', -- ok, missing, altered, fetch_failed
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_injection_monitor_log_site_created 
  ON public.injection_monitor_log(tracked_site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_injection_monitor_log_status 
  ON public.injection_monitor_log(status) WHERE status != 'ok';

-- RLS
ALTER TABLE public.injection_monitor_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monitor logs"
  ON public.injection_monitor_log FOR SELECT
  TO authenticated
  USING (
    tracked_site_id IN (
      SELECT id FROM public.tracked_sites WHERE user_id = auth.uid()
    )
  );
