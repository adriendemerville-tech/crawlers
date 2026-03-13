
ALTER TABLE public.serp_geo_correlations
  ADD COLUMN IF NOT EXISTS spearman_position_vs_llm real,
  ADD COLUMN IF NOT EXISTS spearman_etv_vs_llm real,
  ADD COLUMN IF NOT EXISTS spearman_top10_vs_llm real,
  ADD COLUMN IF NOT EXISTS p_value_position real,
  ADD COLUMN IF NOT EXISTS p_value_etv real,
  ADD COLUMN IF NOT EXISTS p_value_top10 real,
  ADD COLUMN IF NOT EXISTS best_lag_position smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_lag_etv smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_lag_top10 smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_breakdown jsonb DEFAULT '[]'::jsonb;
