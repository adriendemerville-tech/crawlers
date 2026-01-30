-- Supprimer la policy trop permissive
DROP POLICY IF EXISTS "Service role full access" ON public.audits;

-- Note: Le service_role_key bypass automatiquement RLS, donc pas besoin de policy spéciale