
CREATE TABLE public.matrix_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  error_type TEXT NOT NULL DEFAULT 'user_report',
  title TEXT NOT NULL,
  description TEXT,
  batch_id UUID,
  session_id UUID REFERENCES public.matrix_audit_sessions(id) ON DELETE SET NULL,
  context_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matrix_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own errors" ON public.matrix_errors
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own errors" ON public.matrix_errors
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins manage all errors" ON public.matrix_errors
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_matrix_errors_status ON public.matrix_errors(status);
CREATE INDEX idx_matrix_errors_user ON public.matrix_errors(user_id);
