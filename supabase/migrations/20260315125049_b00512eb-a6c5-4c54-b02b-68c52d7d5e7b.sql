
-- Table to persist cocoon session data for future ML training
CREATE TABLE public.cocoon_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_site_id UUID NOT NULL,
  domain TEXT NOT NULL,
  
  -- Graph snapshot
  nodes_count INTEGER NOT NULL DEFAULT 0,
  clusters_count INTEGER NOT NULL DEFAULT 0,
  nodes_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  cluster_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Aggregated scores (training features)
  avg_geo_score NUMERIC(5,2) DEFAULT 0,
  avg_citability_score NUMERIC(5,2) DEFAULT 0,
  avg_eeat_score NUMERIC(5,2) DEFAULT 0,
  avg_roi_predictive NUMERIC(10,2) DEFAULT 0,
  total_traffic_estimate INTEGER DEFAULT 0,
  avg_content_gap NUMERIC(5,2) DEFAULT 0,
  avg_cannibalization_risk NUMERIC(5,2) DEFAULT 0,
  internal_links_density NUMERIC(5,2) DEFAULT 0,
  
  -- Intent distribution (training labels)
  intent_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- AI chat interactions (for RLHF / preference learning)
  chat_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  chat_turns INTEGER NOT NULL DEFAULT 0,
  
  -- Outcome tracking (supervised labels — filled later via GSC/GA4)
  outcome_traffic_delta NUMERIC(10,2),
  outcome_position_delta NUMERIC(5,2),
  outcome_measured_at TIMESTAMPTZ,
  
  -- Metadata
  generation_duration_ms INTEGER,
  model_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cocoon_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cocoon sessions"
  ON public.cocoon_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own cocoon sessions"
  ON public.cocoon_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cocoon sessions"
  ON public.cocoon_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for training queries
CREATE INDEX idx_cocoon_sessions_user ON public.cocoon_sessions(user_id);
CREATE INDEX idx_cocoon_sessions_domain ON public.cocoon_sessions(domain);
CREATE INDEX idx_cocoon_sessions_created ON public.cocoon_sessions(created_at DESC);
CREATE INDEX idx_cocoon_sessions_site ON public.cocoon_sessions(tracked_site_id);

-- Auto-update timestamp
CREATE TRIGGER update_cocoon_sessions_updated_at
  BEFORE UPDATE ON public.cocoon_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
