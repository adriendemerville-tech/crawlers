-- Add local business detection fields to tracked_sites
ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS is_local_business boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS local_schema_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS local_schema_audit jsonb DEFAULT null;

-- Add comment for documentation
COMMENT ON COLUMN public.tracked_sites.is_local_business IS 'Auto-detected: site represents a local/physical business';
COMMENT ON COLUMN public.tracked_sites.local_schema_status IS 'LocalBusiness schema status: unknown, missing, partial, complete';
COMMENT ON COLUMN public.tracked_sites.local_schema_audit IS 'Detailed audit of 6 LocalBusiness schema signals (type, geo, area, price, rating, hours)';