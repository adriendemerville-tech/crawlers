
-- #13: Index on serp_snapshots for faster lookups
CREATE INDEX IF NOT EXISTS idx_serp_snapshots_site_measured
ON public.serp_snapshots (tracked_site_id, measured_at DESC);
