
-- Add new columns to crawl_pages for enhanced analysis
ALTER TABLE public.crawl_pages 
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS schema_org_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS schema_org_errors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_extraction jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS crawl_depth integer DEFAULT 0;

-- Add new columns to crawl_jobs for advanced options
ALTER TABLE public.crawl_jobs 
  ADD COLUMN IF NOT EXISTS max_depth integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS url_filter text,
  ADD COLUMN IF NOT EXISTS custom_selectors jsonb DEFAULT '[]'::jsonb;

-- Add max_depth to site_crawls for display
ALTER TABLE public.site_crawls 
  ADD COLUMN IF NOT EXISTS max_depth integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS url_filter text;
