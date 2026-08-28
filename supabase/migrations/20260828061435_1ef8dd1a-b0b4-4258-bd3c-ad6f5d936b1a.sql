ALTER TABLE public.competitor_matrix_jobs
  ADD COLUMN IF NOT EXISTS seed_serp jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quick_wins jsonb NOT NULL DEFAULT '[]'::jsonb;