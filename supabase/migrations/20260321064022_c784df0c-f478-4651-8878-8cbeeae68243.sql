
-- Add commercial_model and nonprofit_type to tracked_sites
ALTER TABLE public.tracked_sites ADD COLUMN IF NOT EXISTS commercial_model text;
ALTER TABLE public.tracked_sites ADD COLUMN IF NOT EXISTS nonprofit_type text;

-- commercial_model: 'commercial' or 'non_commercial'
-- nonprofit_type: null (if commercial), or one of: 'service_public', 'association_locale', 'ong', 'organisation_internationale', 'federation_sportive', 'syndicat', 'autre'
COMMENT ON COLUMN public.tracked_sites.commercial_model IS 'commercial or non_commercial';
COMMENT ON COLUMN public.tracked_sites.nonprofit_type IS 'Sub-type if non_commercial: service_public, association_locale, ong, organisation_internationale, federation_sportive, syndicat, autre';
