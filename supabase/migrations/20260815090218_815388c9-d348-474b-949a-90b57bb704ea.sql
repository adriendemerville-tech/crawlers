ALTER TABLE public.architect_workbench
  ADD COLUMN IF NOT EXISTS ring_proximity_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anomaly_urgency_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seasonal_boost_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keyword_coverage_score numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.architect_workbench.ring_proximity_score IS 'Breathing Spiral signal 7: proximite au coeur de metier (Ring 1/2/3), 0-12';
COMMENT ON COLUMN public.architect_workbench.anomaly_urgency_score IS 'Breathing Spiral signal 8: urgence liee aux anomalies recentes, 0-12';
COMMENT ON COLUMN public.architect_workbench.seasonal_boost_score IS 'Breathing Spiral signal 9: fenetre saisonniere active, 0-10';
COMMENT ON COLUMN public.architect_workbench.keyword_coverage_score IS 'Breathing Spiral signal 10: trou de couverture SERP du cluster, 0-10';