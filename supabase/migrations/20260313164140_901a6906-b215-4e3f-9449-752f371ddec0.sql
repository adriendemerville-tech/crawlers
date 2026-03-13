
-- 1. audit_cache: restrict read to authenticated only (was anon+authenticated)
DROP POLICY IF EXISTS "Anyone can read audit cache" ON public.audit_cache;
CREATE POLICY "Authenticated can read audit cache"
  ON public.audit_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. analyzed_urls: restrict INSERT to authenticated only (was public/anon)
DROP POLICY IF EXISTS "Anyone can insert analyzed urls" ON public.analyzed_urls;
CREATE POLICY "Authenticated can insert analyzed urls"
  ON public.analyzed_urls
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. analyzed_urls: restrict UPDATE to authenticated only
DROP POLICY IF EXISTS "Anyone can update analyzed urls" ON public.analyzed_urls;
CREATE POLICY "Authenticated can update analyzed urls"
  ON public.analyzed_urls
  FOR UPDATE
  TO authenticated
  USING (true);
