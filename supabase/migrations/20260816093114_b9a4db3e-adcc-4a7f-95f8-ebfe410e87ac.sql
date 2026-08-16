CREATE POLICY "Admins can view all autopilot configs"
ON public.autopilot_configs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));