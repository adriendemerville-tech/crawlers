
CREATE TABLE public.code_deployment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL,
  agent_source TEXT NOT NULL DEFAULT 'cto',
  file_path TEXT NOT NULL,
  previous_content TEXT,
  deployed_content TEXT NOT NULL,
  commit_sha TEXT,
  rollback_commit_sha TEXT,
  is_rolled_back BOOLEAN NOT NULL DEFAULT false,
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by UUID,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.code_deployment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view deployment history"
  ON public.code_deployment_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update deployment history"
  ON public.code_deployment_history FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert deployment history"
  ON public.code_deployment_history FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_deployment_history_proposal ON public.code_deployment_history(proposal_id);
CREATE INDEX idx_deployment_history_agent ON public.code_deployment_history(agent_source);
CREATE INDEX idx_deployment_history_not_rolled_back ON public.code_deployment_history(is_rolled_back) WHERE is_rolled_back = false;
