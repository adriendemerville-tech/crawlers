ALTER TABLE public.site_crawls ADD COLUMN IF NOT EXISTS content_integrity jsonb;
ALTER TABLE public.crawl_pages ADD COLUMN IF NOT EXISTS near_duplicate_group text;
ALTER TABLE public.crawl_pages ADD COLUMN IF NOT EXISTS thin_score integer;
CREATE INDEX IF NOT EXISTS idx_crawl_pages_near_duplicate_group ON public.crawl_pages (crawl_id, near_duplicate_group) WHERE near_duplicate_group IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crawl_pages_thin_score ON public.crawl_pages (crawl_id, thin_score) WHERE thin_score IS NOT NULL;