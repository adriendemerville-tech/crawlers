
ALTER TABLE public.crawl_pages
  ADD COLUMN IF NOT EXISTS h2_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS h3_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS h4_h6_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_noindex boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_nofollow boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS response_time_ms integer,
  ADD COLUMN IF NOT EXISTS redirect_url text,
  ADD COLUMN IF NOT EXISTS anchor_texts jsonb DEFAULT '[]'::jsonb;
