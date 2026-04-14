CREATE POLICY "All authenticated users can read dashboard config"
ON public.admin_dashboard_config
FOR SELECT
TO authenticated
USING (true);