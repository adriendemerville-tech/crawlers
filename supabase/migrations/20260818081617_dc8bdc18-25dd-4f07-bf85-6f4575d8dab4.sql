DROP POLICY IF EXISTS "Users see own scans, anon scans public, admin sees all" ON public.machine_layer_scans;

CREATE POLICY "Owners and admins can view scans"
ON public.machine_layer_scans
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

REVOKE SELECT ON public.machine_layer_scans FROM anon;