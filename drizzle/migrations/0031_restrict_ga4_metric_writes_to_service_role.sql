DROP POLICY IF EXISTS "Users can insert own GA4 daily metrics" ON public.ga4_daily_metrics;
DROP POLICY IF EXISTS "Users can update own GA4 daily metrics" ON public.ga4_daily_metrics;
DROP POLICY IF EXISTS "Users can insert own GA4 top pages" ON public.ga4_top_pages;
DROP POLICY IF EXISTS "Users can update own GA4 top pages" ON public.ga4_top_pages;
DROP POLICY IF EXISTS "Users can insert own GA4 traffic cache" ON public.ga4_traffic_sources_cache;
DROP POLICY IF EXISTS "Users can update own GA4 traffic cache" ON public.ga4_traffic_sources_cache;
DROP POLICY IF EXISTS "Users can delete own GA4 traffic cache" ON public.ga4_traffic_sources_cache;

REVOKE INSERT, UPDATE, DELETE ON public.ga4_daily_metrics FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ga4_top_pages FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ga4_traffic_sources_cache FROM authenticated;

GRANT SELECT ON public.ga4_daily_metrics TO authenticated;
GRANT SELECT ON public.ga4_top_pages TO authenticated;
GRANT SELECT ON public.ga4_traffic_sources_cache TO authenticated;
GRANT ALL ON public.ga4_daily_metrics TO service_role;
GRANT ALL ON public.ga4_top_pages TO service_role;
GRANT ALL ON public.ga4_traffic_sources_cache TO service_role;