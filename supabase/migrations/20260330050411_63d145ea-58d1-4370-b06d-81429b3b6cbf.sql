
-- Table pour historiser la visibilité LLM/GEO à intervalles réguliers
CREATE TABLE public.geo_visibility_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  measurement_phase TEXT NOT NULL DEFAULT 'baseline', -- baseline, t30, t60, t90
  audit_impact_snapshot_id UUID REFERENCES public.audit_impact_snapshots(id) ON DELETE SET NULL,
  
  -- Scores agrégés
  overall_score NUMERIC,
  cited_count INTEGER DEFAULT 0,
  total_models INTEGER DEFAULT 0,
  citation_rate NUMERIC, -- cited_count / total_models * 100
  
  -- Scores par provider
  provider_scores JSONB DEFAULT '[]'::jsonb,
  -- Ex: [{"provider":"chatgpt","score":85,"cited":true,"sentiment":"positive"}, ...]
  
  -- Métriques avancées
  avg_sentiment_score NUMERIC,
  recommendation_rate NUMERIC, -- % de modèles qui recommandent
  brand_mention_count INTEGER DEFAULT 0,
  
  -- Contexte de mesure
  prompts_used JSONB DEFAULT '[]'::jsonb,
  market_sector TEXT,
  
  -- Deltas (calculés par rapport au baseline)
  delta_overall_score NUMERIC,
  delta_citation_rate NUMERIC,
  delta_sentiment NUMERIC,
  
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_geo_vis_site_phase ON public.geo_visibility_snapshots(tracked_site_id, measurement_phase);
CREATE INDEX idx_geo_vis_domain ON public.geo_visibility_snapshots(domain, measured_at DESC);
CREATE INDEX idx_geo_vis_audit ON public.geo_visibility_snapshots(audit_impact_snapshot_id) WHERE audit_impact_snapshot_id IS NOT NULL;

-- RLS
ALTER TABLE public.geo_visibility_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own geo snapshots"
  ON public.geo_visibility_snapshots FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own geo snapshots"
  ON public.geo_visibility_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role insert (for edge functions)
CREATE POLICY "Service can manage geo snapshots"
  ON public.geo_visibility_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
