
-- Table to store imported prompt matrices from CSV
CREATE TABLE public.prompt_matrix_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  file_name TEXT NOT NULL,
  column_mapping JSONB NOT NULL DEFAULT '{}',
  raw_data JSONB NOT NULL DEFAULT '[]',
  row_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.prompt_matrix_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own matrices"
ON public.prompt_matrix_imports
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX idx_prompt_matrix_site ON public.prompt_matrix_imports(tracked_site_id);
