
DROP POLICY IF EXISTS "Service role full access" ON public.keyword_universe;

-- Service role bypasses RLS natively, so this permissive policy is unnecessary.
-- The user-scoped policies are sufficient. Edge functions using service_role key bypass RLS automatically.
