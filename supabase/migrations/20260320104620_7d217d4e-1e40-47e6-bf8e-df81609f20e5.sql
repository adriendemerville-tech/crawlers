
CREATE TABLE public.supervisor_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id TEXT,
  analysis_summary TEXT NOT NULL DEFAULT '',
  self_critique TEXT NOT NULL DEFAULT '',
  confidence_score NUMERIC DEFAULT 0,
  decision TEXT DEFAULT 'needs_review',
  cto_score NUMERIC,
  correction_count INTEGER DEFAULT 0,
  functions_audited TEXT[] DEFAULT '{}',
  post_deploy_errors INTEGER DEFAULT 0,
  metadata JSONB,
  status TEXT DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supervisor_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read supervisor_logs" ON public.supervisor_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service insert supervisor_logs" ON public.supervisor_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Admin update supervisor_logs" ON public.supervisor_logs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
