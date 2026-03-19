
-- Fix last always-true: analyzed_urls UPDATE
DROP POLICY IF EXISTS "Authenticated can update analyzed urls" ON public.analyzed_urls;
CREATE POLICY "Authenticated can update analyzed urls"
  ON public.analyzed_urls FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
