
-- Allow admins to manage all dashboard configs
CREATE POLICY "Admins can manage all dashboard configs"
ON public.admin_dashboard_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
