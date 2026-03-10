CREATE POLICY "Authenticated can read audit cache"
ON public.audit_cache
FOR SELECT
TO authenticated
USING (true);