
-- Autopilot configurations
CREATE TABLE public.autopilot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  
  -- Diagnostic phase (multi-select)
  diag_audit_complet BOOLEAN DEFAULT false,
  diag_crawl BOOLEAN DEFAULT false,
  diag_stratege_cocoon BOOLEAN DEFAULT false,
  
  -- Prescription phase (multi-select)
  presc_stratege_cocoon BOOLEAN DEFAULT false,
  presc_architect BOOLEAN DEFAULT false,
  presc_content_architect BOOLEAN DEFAULT false,
  
  -- Implementation mode (single-select)
  implementation_mode TEXT DEFAULT 'dry_run' CHECK (implementation_mode IN ('dry_run', 'one_shot', 'one_shot_feedback', 'auto')),
  
  -- Guardrails
  max_pages_per_cycle INTEGER DEFAULT 10,
  cooldown_hours INTEGER DEFAULT 48,
  auto_pause_threshold NUMERIC DEFAULT 15.0,
  excluded_subdomains TEXT[] DEFAULT '{}',
  excluded_page_types TEXT[] DEFAULT '{}',
  
  -- State
  last_cycle_at TIMESTAMPTZ,
  total_cycles_run INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'error')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, tracked_site_id)
);

-- Modification log
CREATE TABLE public.autopilot_modification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE NOT NULL,
  config_id UUID REFERENCES public.autopilot_configs(id) ON DELETE SET NULL,
  
  cycle_number INTEGER DEFAULT 1,
  phase TEXT NOT NULL CHECK (phase IN ('diagnostic', 'prescription', 'implementation')),
  action_type TEXT NOT NULL,
  page_url TEXT,
  description TEXT,
  diff_before JSONB,
  diff_after JSONB,
  status TEXT DEFAULT 'applied' CHECK (status IN ('applied', 'rolled_back', 'failed', 'simulated')),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.autopilot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autopilot_modification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own autopilot configs"
ON public.autopilot_configs FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own modification logs"
ON public.autopilot_modification_log FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_autopilot_configs_site ON public.autopilot_configs(tracked_site_id);
CREATE INDEX idx_autopilot_mod_log_site ON public.autopilot_modification_log(tracked_site_id, created_at DESC);
