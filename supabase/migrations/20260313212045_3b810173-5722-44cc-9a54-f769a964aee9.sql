CREATE UNIQUE INDEX IF NOT EXISTS uq_serp_geo_correlations_site 
ON public.serp_geo_correlations (tracked_site_id);