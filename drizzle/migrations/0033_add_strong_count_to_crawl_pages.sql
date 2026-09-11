ALTER TABLE public.crawl_pages
  ADD COLUMN IF NOT EXISTS strong_count integer NOT NULL DEFAULT 0;