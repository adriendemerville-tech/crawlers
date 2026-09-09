DROP POLICY IF EXISTS "Authenticated can insert analyzed urls" ON public.analyzed_urls;
DROP POLICY IF EXISTS "Authenticated can update analyzed urls" ON public.analyzed_urls;

REVOKE INSERT, UPDATE, DELETE ON public.analyzed_urls FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.analyzed_urls FROM anon;
GRANT SELECT ON public.analyzed_urls TO authenticated;
GRANT ALL ON public.analyzed_urls TO service_role;