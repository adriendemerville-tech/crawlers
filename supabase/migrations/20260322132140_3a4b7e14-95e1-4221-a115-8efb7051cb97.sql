
-- Add body_text_truncated column to crawl_pages for Cocoon semantic analysis
ALTER TABLE public.crawl_pages ADD COLUMN IF NOT EXISTS body_text_truncated TEXT;

-- Add comment
COMMENT ON COLUMN public.crawl_pages.body_text_truncated IS 'First 5000 chars of visible body text for semantic analysis (TF-IDF, clustering)';
