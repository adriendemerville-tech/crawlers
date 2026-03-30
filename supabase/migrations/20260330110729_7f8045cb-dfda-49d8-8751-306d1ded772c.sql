
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marina_brand_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS marina_custom_intro text,
  ADD COLUMN IF NOT EXISTS marina_custom_cta_text text,
  ADD COLUMN IF NOT EXISTS marina_custom_cta_url text,
  ADD COLUMN IF NOT EXISTS marina_hide_crawlers_badge boolean DEFAULT false;
