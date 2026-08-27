ALTER TABLE public.competitor_matrix_jobs
  ADD COLUMN IF NOT EXISTS serp JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS out_of_scope JSONB NOT NULL DEFAULT '[]'::jsonb;