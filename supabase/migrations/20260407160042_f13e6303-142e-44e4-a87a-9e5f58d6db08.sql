
-- 1. Voice DNA on tracked_sites
ALTER TABLE public.tracked_sites
ADD COLUMN IF NOT EXISTS voice_dna jsonb DEFAULT NULL;

COMMENT ON COLUMN public.tracked_sites.voice_dna IS 'Editorial voice profile: posture, register, lexicon, tone overrides per page type, reference excerpts';

-- 2. Tone analysis per crawled page
ALTER TABLE public.crawl_pages
ADD COLUMN IF NOT EXISTS tone_analysis jsonb DEFAULT NULL;

COMMENT ON COLUMN public.crawl_pages.tone_analysis IS 'Per-page tone extraction: register, posture, density, formality_score (0-100)';

-- 3. Tone consistency score on site_crawls
ALTER TABLE public.site_crawls
ADD COLUMN IF NOT EXISTS tone_consistency_score integer DEFAULT NULL;

COMMENT ON COLUMN public.site_crawls.tone_consistency_score IS 'Overall tone coherence score (0-100) across all crawled pages';
