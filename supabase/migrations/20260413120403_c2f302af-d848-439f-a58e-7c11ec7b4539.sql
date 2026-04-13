
-- 1. audit_cache: remove permissive SELECT, restrict to service_role only
DROP POLICY IF EXISTS "Authenticated can read audit cache" ON public.audit_cache;
DROP POLICY IF EXISTS "Service role full access" ON public.audit_cache;

CREATE POLICY "Service role only access"
ON public.audit_cache FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. analyzed_urls: fix UPDATE policy to service_role only
DROP POLICY IF EXISTS "Authenticated users can update analyzed URLs" ON public.analyzed_urls;
DROP POLICY IF EXISTS "Anyone can update analyzed URLs" ON public.analyzed_urls;

-- Keep SELECT public for SEO counters display, but restrict writes
CREATE POLICY "Service role can update analyzed_urls"
ON public.analyzed_urls FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can insert analyzed_urls"
ON public.analyzed_urls FOR INSERT
TO service_role
WITH CHECK (true);

-- Drop any overly permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert analyzed URLs" ON public.analyzed_urls;
DROP POLICY IF EXISTS "Anyone can insert analyzed URLs" ON public.analyzed_urls;

-- 3. ga4_daily_metrics: fix service role policy
DROP POLICY IF EXISTS "Service role full access" ON public.ga4_daily_metrics;
CREATE POLICY "Service role full access"
ON public.ga4_daily_metrics FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Remove any authenticated/anon SELECT policies
DROP POLICY IF EXISTS "Users can view own ga4 metrics" ON public.ga4_daily_metrics;
DROP POLICY IF EXISTS "Authenticated can read ga4_daily_metrics" ON public.ga4_daily_metrics;

-- 4. ga4_top_pages: fix service role policy
DROP POLICY IF EXISTS "Service role full access" ON public.ga4_top_pages;
CREATE POLICY "Service role full access"
ON public.ga4_top_pages FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own ga4 top pages" ON public.ga4_top_pages;
DROP POLICY IF EXISTS "Authenticated can read ga4_top_pages" ON public.ga4_top_pages;

-- 5. gsc_daily_positions: same treatment
DROP POLICY IF EXISTS "Service role full access" ON public.gsc_daily_positions;
CREATE POLICY "Service role full access"
ON public.gsc_daily_positions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own gsc positions" ON public.gsc_daily_positions;
DROP POLICY IF EXISTS "Authenticated can read gsc_daily_positions" ON public.gsc_daily_positions;
