
-- Add previous_config column to tracked_sites for rollback support
ALTER TABLE public.tracked_sites 
ADD COLUMN IF NOT EXISTS previous_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add fair use tracking: monthly crawl page counter on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS crawl_pages_this_month integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS crawl_month_reset text NOT NULL DEFAULT to_char(now(), 'YYYY-MM');
