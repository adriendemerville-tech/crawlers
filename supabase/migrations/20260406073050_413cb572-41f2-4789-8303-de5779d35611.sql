
CREATE TABLE public.agent_cto_directives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  directive_text TEXT NOT NULL,
  target_function TEXT,
  target_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_cto_directives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage CTO directives"
  ON public.agent_cto_directives
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_cto_directives_status ON public.agent_cto_directives (status) WHERE status = 'pending';

CREATE TRIGGER update_cto_directives_updated_at
  BEFORE UPDATE ON public.agent_cto_directives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
