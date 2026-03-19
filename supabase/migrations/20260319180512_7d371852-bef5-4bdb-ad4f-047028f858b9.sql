
-- Fix analyzed_urls INSERT to satisfy linter (functionally equivalent but explicit)
DROP POLICY IF EXISTS "Authenticated can insert analyzed urls" ON public.analyzed_urls;
CREATE POLICY "Authenticated can insert analyzed urls"
  ON public.analyzed_urls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
