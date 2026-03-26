
DROP POLICY IF EXISTS "Service role full access on prompt_registry" ON public.prompt_registry;

CREATE POLICY "Service role full access on prompt_registry"
  ON public.prompt_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
