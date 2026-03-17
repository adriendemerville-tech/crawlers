ALTER TABLE tracked_sites
  ADD COLUMN IF NOT EXISTS primary_language text DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS competitors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cms_platform text,
  ADD COLUMN IF NOT EXISTS founding_year integer,
  ADD COLUMN IF NOT EXISTS siren_siret text,
  ADD COLUMN IF NOT EXISTS gmb_presence boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gmb_city text,
  ADD COLUMN IF NOT EXISTS social_profiles jsonb DEFAULT '{}'::jsonb;