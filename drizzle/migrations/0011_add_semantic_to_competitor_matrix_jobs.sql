ALTER TABLE public.competitor_matrix_jobs
  ADD COLUMN IF NOT EXISTS semantic JSONB;