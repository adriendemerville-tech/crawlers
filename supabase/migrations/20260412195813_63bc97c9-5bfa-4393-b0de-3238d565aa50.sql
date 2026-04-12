
-- ============================================================
-- M1 : Table cluster_definitions
-- ============================================================
CREATE TABLE public.cluster_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cluster_name text NOT NULL,
  ring smallint NOT NULL DEFAULT 1 CHECK (ring BETWEEN 1 AND 3),
  keywords text[] DEFAULT '{}',
  maturity_pct numeric DEFAULT 0,
  total_items integer DEFAULT 0,
  deployed_items integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tracked_site_id, cluster_name)
);

ALTER TABLE public.cluster_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clusters"
  ON public.cluster_definitions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clusters"
  ON public.cluster_definitions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clusters"
  ON public.cluster_definitions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clusters"
  ON public.cluster_definitions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on cluster_definitions"
  ON public.cluster_definitions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- M2a : keyword_universe — semantic_ring + cluster_id
-- ============================================================
ALTER TABLE public.keyword_universe
  ADD COLUMN semantic_ring smallint DEFAULT 3,
  ADD COLUMN cluster_id uuid REFERENCES public.cluster_definitions(id) ON DELETE SET NULL;

-- ============================================================
-- M2b : architect_workbench — colonnes spiral
-- ============================================================
ALTER TABLE public.architect_workbench
  ADD COLUMN spiral_score numeric DEFAULT 0,
  ADD COLUMN velocity_decay_score numeric DEFAULT 0,
  ADD COLUMN competitor_momentum_score numeric DEFAULT 0,
  ADD COLUMN cluster_maturity_pct numeric DEFAULT 0,
  ADD COLUMN conversion_weight numeric DEFAULT 1,
  ADD COLUMN gmb_urgency_score numeric DEFAULT 0,
  ADD COLUMN cooldown_until timestamptz,
  ADD COLUMN cluster_id uuid REFERENCES public.cluster_definitions(id) ON DELETE SET NULL;

-- ============================================================
-- M3 : Index de performance
-- ============================================================
CREATE INDEX idx_workbench_spiral_score
  ON public.architect_workbench(user_id, domain, spiral_score DESC)
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX idx_workbench_cooldown
  ON public.architect_workbench(cooldown_until)
  WHERE cooldown_until IS NOT NULL;

CREATE INDEX idx_keyword_universe_ring
  ON public.keyword_universe(tracked_site_id, semantic_ring);

CREATE INDEX idx_keyword_universe_cluster
  ON public.keyword_universe(cluster_id)
  WHERE cluster_id IS NOT NULL;

CREATE INDEX idx_cluster_definitions_site
  ON public.cluster_definitions(tracked_site_id, ring);
