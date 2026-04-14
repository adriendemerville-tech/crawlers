-- Add guide-specific columns to seo_page_drafts
ALTER TABLE public.seo_page_drafts
  ADD COLUMN IF NOT EXISTS guide_category text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS guide_target text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS guide_tools jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lateral_links jsonb DEFAULT '[]'::jsonb;

-- Add index for efficient guide listing queries
CREATE INDEX IF NOT EXISTS idx_seo_page_drafts_type_status
  ON public.seo_page_drafts (page_type, status);

-- Add comment for documentation
COMMENT ON COLUMN public.seo_page_drafts.guide_category IS 'bloc_a (métiers/PME) or bloc_b (pros SEO/marketing)';
COMMENT ON COLUMN public.seo_page_drafts.guide_target IS 'Target audience slug (artisan, pme, agence-seo, etc.)';
COMMENT ON COLUMN public.seo_page_drafts.guide_tools IS 'Array of {name, href, description} for featured Crawlers tools';
COMMENT ON COLUMN public.seo_page_drafts.lateral_links IS 'Array of {slug, title, description} for lateral linking between guides';