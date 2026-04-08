
-- 1. Table matrix_display_schemas
CREATE TABLE public.matrix_display_schemas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  schema_hash TEXT NOT NULL,
  schema_name TEXT NOT NULL DEFAULT 'Auto-generated',
  columns_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  scoring_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_file_signature TEXT,
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_matrix_display_schemas_hash_user ON public.matrix_display_schemas (user_id, schema_hash);
CREATE INDEX idx_matrix_display_schemas_user ON public.matrix_display_schemas (user_id);

ALTER TABLE public.matrix_display_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own display schemas"
  ON public.matrix_display_schemas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own display schemas"
  ON public.matrix_display_schemas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own display schemas"
  ON public.matrix_display_schemas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_matrix_display_schemas_updated_at
  BEFORE UPDATE ON public.matrix_display_schemas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Extend tracked_sites identity card
ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS target_segment TEXT,
  ADD COLUMN IF NOT EXISTS primary_use_case TEXT,
  ADD COLUMN IF NOT EXISTS location_detail TEXT,
  ADD COLUMN IF NOT EXISTS brand_site_url TEXT;
