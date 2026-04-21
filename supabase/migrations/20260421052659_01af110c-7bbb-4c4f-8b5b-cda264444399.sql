
-- Add target_countries to tracked_sites (default France)
ALTER TABLE public.tracked_sites
ADD COLUMN IF NOT EXISTS target_countries text[] NOT NULL DEFAULT ARRAY['fra'];

-- Add country to gsc_daily_positions
ALTER TABLE public.gsc_daily_positions
ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'fra';

-- Drop old unique constraint and recreate with country
ALTER TABLE public.gsc_daily_positions
DROP CONSTRAINT IF EXISTS gsc_daily_positions_tracked_site_id_query_date_val_key;

CREATE UNIQUE INDEX IF NOT EXISTS gsc_daily_positions_site_query_date_country_key
ON public.gsc_daily_positions (tracked_site_id, query, date_val, country);

-- Index for country filtering
CREATE INDEX IF NOT EXISTS idx_gsc_daily_positions_country
ON public.gsc_daily_positions (tracked_site_id, country, date_val);
