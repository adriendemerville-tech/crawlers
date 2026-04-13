
-- ═══════════════════════════════════════════════════════════════
-- 1. FIX ga4_daily_metrics: drop public "service role" policy, recreate for service_role
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Service role full access ga4_daily" ON public.ga4_daily_metrics;

-- Recreate restricted to service_role (not public/anon)
CREATE POLICY "Service role full access ga4_daily"
  ON public.ga4_daily_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 2. FIX ga4_top_pages: same issue
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Service role full access ga4_top_pages" ON public.ga4_top_pages;

CREATE POLICY "Service role full access ga4_top_pages"
  ON public.ga4_top_pages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 3. FIX gsc_daily_positions: restrict INSERT to service_role
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Service can insert daily positions" ON public.gsc_daily_positions;

CREATE POLICY "Service role can insert daily positions"
  ON public.gsc_daily_positions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 4. FIX short_links: restrict public SELECT to code-based lookup only
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anyone can read short links by code for redirect" ON public.short_links;

-- Create a security definer function for code-based lookup
CREATE OR REPLACE FUNCTION public.get_short_link_by_code(p_code text)
RETURNS TABLE(id uuid, code text, target_url text, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, code, target_url, expires_at
  FROM public.short_links
  WHERE code = p_code
    AND (expires_at IS NULL OR expires_at > now());
$$;

-- Allow authenticated users to read their own short links
CREATE POLICY "Users can read own short links"
  ON public.short_links
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- Service role retains full access
CREATE POLICY "Service role full access short_links"
  ON public.short_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
