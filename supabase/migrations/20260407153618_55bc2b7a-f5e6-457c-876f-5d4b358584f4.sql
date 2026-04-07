
-- Table for UX Agent directives (same structure as other agent directives)
CREATE TABLE public.agent_ux_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  directive_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  target_component TEXT,
  target_url TEXT,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_ux_directives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage UX directives" ON public.agent_ux_directives
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add agent_source 'ux' to cto_code_proposals enum support (it's a text column, no enum needed)
-- UX proposals will use agent_source = 'ux' in cto_code_proposals table

-- Table for UX agent analysis logs
CREATE TABLE public.agent_ux_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_analyzed TEXT NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT 'visual_audit',
  findings JSON DEFAULT '[]',
  proposals_generated INT DEFAULT 0,
  confidence_score NUMERIC(5,2) DEFAULT 0,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_ux_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read UX logs" ON public.agent_ux_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
