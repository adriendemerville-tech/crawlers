
-- Table: serp_geo_correlations — weekly SERP↔GEO correlation per tracked site
CREATE TABLE public.serp_geo_correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  -- Pearson correlation coefficients
  pearson_position_vs_llm numeric,       -- avg_position vs avg llm_visibility
  pearson_etv_vs_llm numeric,            -- estimated traffic value vs avg llm_visibility
  pearson_top10_vs_llm numeric,          -- top_10 count vs avg llm_visibility
  -- Interpretation
  convergence_index numeric,             -- weighted composite: 0-100
  trend_label text,                       -- 'convergent' | 'divergent' | 'decorrelated' | 'insufficient_data'
  -- Data window
  weeks_analyzed integer NOT NULL DEFAULT 0,
  serp_data_points jsonb DEFAULT '[]'::jsonb,   -- [{week, avg_position, etv, top_10}]
  llm_data_points jsonb DEFAULT '[]'::jsonb,    -- [{week, avg_score}]
  -- Timestamps
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.serp_geo_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own correlations"
  ON public.serp_geo_correlations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage correlations"
  ON public.serp_geo_correlations FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_serp_geo_corr_site ON public.serp_geo_correlations (tracked_site_id, calculated_at DESC);
