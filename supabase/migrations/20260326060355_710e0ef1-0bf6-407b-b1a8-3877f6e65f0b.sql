
-- Drop the overly permissive anon policy
DROP POLICY IF EXISTS "Anyone can read system_config" ON public.system_config;

-- Allow only authenticated users to read system_config
CREATE POLICY "Authenticated users can read system_config"
  ON public.system_config
  FOR SELECT
  TO authenticated
  USING (true);
