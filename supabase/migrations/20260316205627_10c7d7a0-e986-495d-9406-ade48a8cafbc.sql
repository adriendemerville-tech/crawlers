CREATE POLICY "Anyone can read system_config"
  ON public.system_config FOR SELECT
  TO anon
  USING (true);