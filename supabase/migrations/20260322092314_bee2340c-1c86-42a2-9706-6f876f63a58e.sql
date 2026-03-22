
-- Table de traçabilité des tentatives d'injection non-autorisées
CREATE TABLE public.injection_abuse_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  target_domain TEXT NOT NULL,
  target_site_id UUID,
  owner_user_id UUID,
  abuse_type TEXT NOT NULL DEFAULT 'ownership_mismatch',
  script_type TEXT,
  script_payload_preview TEXT,
  request_metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  is_reviewed BOOLEAN DEFAULT false,
  admin_notes TEXT
);

-- RLS: only admins can read
ALTER TABLE public.injection_abuse_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for injection_abuse_logs"
ON public.injection_abuse_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can read injection_abuse_logs"
ON public.injection_abuse_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Index for admin queries
CREATE INDEX idx_injection_abuse_logs_created ON public.injection_abuse_logs(created_at DESC);
CREATE INDEX idx_injection_abuse_logs_user ON public.injection_abuse_logs(user_id);
