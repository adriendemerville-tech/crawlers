
ALTER TABLE public.semantic_nodes
  ADD COLUMN IF NOT EXISTS crawl_depth integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_type text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS page_updated_at timestamptz;
