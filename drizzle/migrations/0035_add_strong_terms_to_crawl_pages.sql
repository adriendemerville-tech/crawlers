ALTER TABLE public.crawl_pages
  ADD COLUMN IF NOT EXISTS strong_terms jsonb NOT NULL DEFAULT '[]'::jsonb;