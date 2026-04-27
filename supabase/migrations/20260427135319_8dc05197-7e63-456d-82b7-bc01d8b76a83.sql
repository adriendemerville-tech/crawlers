-- Recrée la vue publique en pointant sur la table unifiée
DROP VIEW IF EXISTS public.google_ads_connections_public CASCADE;

CREATE VIEW public.google_ads_connections_public
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  ads_customer_id AS customer_id,
  ads_account_name AS account_name,
  COALESCE(ads_status, 'active') AS status,
  (ads_status = 'active' OR ads_status IS NULL) AS is_active,
  scopes,
  updated_at,
  created_at
FROM public.google_connections
WHERE ads_customer_id IS NOT NULL;

-- Permissions
GRANT SELECT ON public.google_ads_connections_public TO authenticated;

COMMENT ON VIEW public.google_ads_connections_public IS
'Compat view (since 2026-04-27) — exposes Google Ads connection metadata from the unified google_connections table. RLS is enforced via security_invoker on the underlying table.';