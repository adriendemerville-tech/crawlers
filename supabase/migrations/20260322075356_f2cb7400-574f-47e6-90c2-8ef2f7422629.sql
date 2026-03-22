
-- Strategist recommendations memory: tracks every recommendation per URL/user for feedback loop
CREATE TABLE public.strategist_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  strategy_plan_id UUID REFERENCES public.cocoon_strategy_plans(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'prescribed',
  execution_mode TEXT,
  metadata JSONB DEFAULT '{}',
  gsc_baseline JSONB,
  gsc_measured JSONB,
  ga4_baseline JSONB,
  ga4_measured JSONB,
  measured_at TIMESTAMPTZ,
  impact_score NUMERIC,
  outcome_assessment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_strat_reco_user_domain ON public.strategist_recommendations(user_id, domain);
CREATE INDEX idx_strat_reco_url ON public.strategist_recommendations(url);
CREATE INDEX idx_strat_reco_tracked ON public.strategist_recommendations(tracked_site_id);

-- RLS
ALTER TABLE public.strategist_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations"
  ON public.strategist_recommendations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all"
  ON public.strategist_recommendations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_strategist_recommendations_updated_at
  BEFORE UPDATE ON public.strategist_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
