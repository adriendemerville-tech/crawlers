
-- Parménion Decision Log: tracks every decision with predicted vs actual impact
CREATE TABLE public.parmenion_decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  
  -- BUT (goal)
  goal_type TEXT NOT NULL, -- 'cluster_optimization', 'content_gap', 'linking', 'technical_fix'
  goal_cluster_id TEXT,
  goal_description TEXT NOT NULL,
  
  -- TACTIQUE (scope)
  initial_scope JSONB NOT NULL DEFAULT '{}', -- pages targeted initially
  final_scope JSONB NOT NULL DEFAULT '{}',   -- pages actually processed (after reduction)
  scope_reductions INTEGER NOT NULL DEFAULT 0, -- how many times scope was reduced
  estimated_tokens INTEGER,
  
  -- PRUDENCE (risk assessment)
  impact_level TEXT NOT NULL DEFAULT 'neutral', -- faible, modéré, neutre, avancé, très_avancé
  risk_predicted INTEGER NOT NULL DEFAULT 1 CHECK (risk_predicted >= 1 AND risk_predicted <= 3),
  risk_iterations INTEGER NOT NULL DEFAULT 0, -- how many times risk was recalculated
  goal_changed BOOLEAN NOT NULL DEFAULT false, -- true if goal had to change due to 3 failed risk iterations
  
  -- Action taken
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}',
  functions_called TEXT[] NOT NULL DEFAULT '{}',
  
  -- Execution
  status TEXT NOT NULL DEFAULT 'planned', -- planned, executing, completed, failed, skipped
  execution_started_at TIMESTAMPTZ,
  execution_completed_at TIMESTAMPTZ,
  execution_error TEXT,
  
  -- FEEDBACK: predicted vs actual (filled at T+30)
  impact_predicted TEXT, -- faible, modéré, neutre, avancé, très_avancé
  impact_actual TEXT,    -- filled by parmenion-feedback
  risk_calibrated INTEGER, -- corrected risk score after measurement
  calibration_note TEXT,
  measured_at TIMESTAMPTZ,
  
  -- GSC metrics at decision time (baseline)
  baseline_clicks INTEGER,
  baseline_impressions INTEGER,
  baseline_ctr NUMERIC,
  baseline_position NUMERIC,
  
  -- GSC metrics at T+30
  t30_clicks INTEGER,
  t30_impressions INTEGER,
  t30_ctr NUMERIC,
  t30_position NUMERIC,
  
  -- Learning
  is_error BOOLEAN NOT NULL DEFAULT false, -- true if impact_actual diverges from impact_predicted
  error_category TEXT, -- 'overestimated_impact', 'underestimated_risk', 'wrong_cluster', 'scope_too_large'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_parmenion_log_site ON public.parmenion_decision_log(tracked_site_id);
CREATE INDEX idx_parmenion_log_user ON public.parmenion_decision_log(user_id);
CREATE INDEX idx_parmenion_log_domain ON public.parmenion_decision_log(domain);
CREATE INDEX idx_parmenion_log_status ON public.parmenion_decision_log(status);
CREATE INDEX idx_parmenion_log_errors ON public.parmenion_decision_log(domain, is_error) WHERE is_error = true;
CREATE INDEX idx_parmenion_log_feedback ON public.parmenion_decision_log(status, measured_at) WHERE status = 'completed' AND measured_at IS NULL;

-- RLS
ALTER TABLE public.parmenion_decision_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decisions"
  ON public.parmenion_decision_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages decisions"
  ON public.parmenion_decision_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_parmenion_log_updated_at
  BEFORE UPDATE ON public.parmenion_decision_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper function: get error rate for conservative mode check (threshold: 20%)
CREATE OR REPLACE FUNCTION public.parmenion_error_rate(p_domain TEXT, p_last_n INTEGER DEFAULT 10)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH recent AS (
    SELECT is_error
    FROM parmenion_decision_log
    WHERE domain = p_domain
      AND status = 'completed'
      AND measured_at IS NOT NULL
    ORDER BY created_at DESC
    LIMIT p_last_n
  )
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'errors', COUNT(*) FILTER (WHERE is_error),
    'error_rate', CASE WHEN COUNT(*) > 0 
      THEN ROUND(COUNT(*) FILTER (WHERE is_error)::numeric / COUNT(*)::numeric * 100, 1) 
      ELSE 0 END,
    'conservative_mode', CASE WHEN COUNT(*) >= 5 AND 
      (COUNT(*) FILTER (WHERE is_error)::numeric / COUNT(*)::numeric * 100) > 20 
      THEN true ELSE false END
  )
  FROM recent;
$$;

-- Helper: get last N errors for few-shot injection
CREATE OR REPLACE FUNCTION public.parmenion_recent_errors(p_domain TEXT, p_limit INTEGER DEFAULT 5)
RETURNS TABLE(
  cycle_number INTEGER,
  goal_description TEXT,
  action_type TEXT,
  risk_predicted INTEGER,
  risk_calibrated INTEGER,
  impact_predicted TEXT,
  impact_actual TEXT,
  calibration_note TEXT,
  error_category TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT cycle_number, goal_description, action_type, 
         risk_predicted, risk_calibrated, impact_predicted, 
         impact_actual, calibration_note, error_category
  FROM parmenion_decision_log
  WHERE domain = p_domain AND is_error = true
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;
