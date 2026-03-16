
-- Table pour stocker les prompts CSV avec classification et métriques
CREATE TABLE public.prompt_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE SET NULL,
  
  -- Prompt data
  prompt_text TEXT NOT NULL,
  prompt_label TEXT,
  source_csv_filename TEXT,
  
  -- Classification
  target_type TEXT NOT NULL DEFAULT 'onsite' CHECK (target_type IN ('onsite', 'offshore')),
  category TEXT,
  
  -- API & cost tracking
  api_used TEXT,
  llm_model TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  estimated_cost_eur NUMERIC(10,6) DEFAULT 0,
  
  -- Deployment status
  is_deployed BOOLEAN DEFAULT false,
  deployed_at TIMESTAMPTZ,
  
  -- ROI & impact measurement
  roi_pertinence_score NUMERIC(5,2),
  roi_measured_at TIMESTAMPTZ,
  roi_context JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_prompt_deployments_user ON public.prompt_deployments(user_id);
CREATE INDEX idx_prompt_deployments_client ON public.prompt_deployments(client_id);
CREATE INDEX idx_prompt_deployments_target ON public.prompt_deployments(target_type);
CREATE INDEX idx_prompt_deployments_deployed ON public.prompt_deployments(is_deployed);

-- Trigger updated_at
CREATE TRIGGER update_prompt_deployments_updated_at
  BEFORE UPDATE ON public.prompt_deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.prompt_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prompt deployments"
ON public.prompt_deployments FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all prompt deployments"
ON public.prompt_deployments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
