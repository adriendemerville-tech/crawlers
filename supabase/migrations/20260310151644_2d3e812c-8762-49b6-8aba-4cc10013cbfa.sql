-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Authenticated can read audit cache" ON public.audit_cache;

-- Create new policy allowing both anon and authenticated to read cache
CREATE POLICY "Anyone can read audit cache"
ON public.audit_cache
FOR SELECT
TO anon, authenticated
USING (true);