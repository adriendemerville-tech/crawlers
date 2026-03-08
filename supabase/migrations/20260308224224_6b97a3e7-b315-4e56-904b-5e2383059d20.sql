
-- Prompt registry: stores versioned prompts for audit functions
CREATE TABLE public.prompt_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  prompt_key text NOT NULL DEFAULT 'system',
  version integer NOT NULL DEFAULT 1,
  prompt_text text NOT NULL,
  is_champion boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT 'manual',
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(function_name, prompt_key, version)
);

ALTER TABLE public.prompt_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage prompt_registry"
  ON public.prompt_registry FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access on prompt_registry"
  ON public.prompt_registry FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- CTO Agent logs: stores self-critique and decisions
CREATE TABLE public.cto_agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id text,
  function_analyzed text NOT NULL,
  analysis_summary text NOT NULL,
  self_critique text NOT NULL,
  confidence_score numeric NOT NULL DEFAULT 0,
  proposed_change text,
  change_diff_pct numeric DEFAULT 0,
  decision text NOT NULL DEFAULT 'rejected',
  prompt_version_before integer,
  prompt_version_after integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.cto_agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cto_agent_logs"
  ON public.cto_agent_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System config for agent toggle (reuse system_metrics or create simple config)
CREATE TABLE public.system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system_config"
  ON public.system_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read system_config"
  ON public.system_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert default config
INSERT INTO public.system_config (key, value) VALUES ('cto_agent_enabled', '{"enabled": false}'::jsonb);
