
-- Table for logging injection errors detected by test checks
CREATE TABLE public.injection_error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.site_script_rules(id) ON DELETE CASCADE NOT NULL,
  domain_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  error_type TEXT NOT NULL, -- 'not_arrived', 'deploy_fail', 'stale_ping'
  error_details JSONB DEFAULT '{}'::jsonb,
  domain TEXT NOT NULL,
  url_pattern TEXT NOT NULL,
  payload_type TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for admin dashboard queries
CREATE INDEX idx_injection_errors_created ON public.injection_error_logs (created_at DESC);
CREATE INDEX idx_injection_errors_type ON public.injection_error_logs (error_type, created_at DESC);

-- RLS
ALTER TABLE public.injection_error_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own errors
CREATE POLICY "Users can insert own injection errors"
ON public.injection_error_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can view their own errors
CREATE POLICY "Users can view own injection errors"
ON public.injection_error_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all injection errors"
ON public.injection_error_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update (resolve)
CREATE POLICY "Admins can update injection errors"
ON public.injection_error_logs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
