
-- Table to store diagnostic results from the 4 diagnostic modules
CREATE TABLE public.cocoon_diagnostic_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  diagnostic_type TEXT NOT NULL, -- 'content' | 'semantic' | 'structure' | 'authority'
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_cocoon_diag_site_type ON public.cocoon_diagnostic_results(tracked_site_id, diagnostic_type);
CREATE INDEX idx_cocoon_diag_user ON public.cocoon_diagnostic_results(user_id);

-- RLS
ALTER TABLE public.cocoon_diagnostic_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own diagnostics"
  ON public.cocoon_diagnostic_results FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access diagnostics"
  ON public.cocoon_diagnostic_results FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Strategy plans table for the Strategist orchestrator
CREATE TABLE public.cocoon_strategy_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  diagnostic_ids UUID[] NOT NULL DEFAULT '{}',
  strategy JSONB NOT NULL DEFAULT '{}'::jsonb, -- prioritized tasks, calendar, etc.
  status TEXT NOT NULL DEFAULT 'draft', -- draft | validated | executing | completed
  task_budget INTEGER NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cocoon_strategy_site ON public.cocoon_strategy_plans(tracked_site_id);

ALTER TABLE public.cocoon_strategy_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own strategy plans"
  ON public.cocoon_strategy_plans FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own strategy plans"
  ON public.cocoon_strategy_plans FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access strategy"
  ON public.cocoon_strategy_plans FOR ALL TO service_role
  USING (true) WITH CHECK (true);
