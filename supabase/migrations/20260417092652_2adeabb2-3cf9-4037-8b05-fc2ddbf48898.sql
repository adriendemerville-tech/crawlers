-- Recreate view with security_barrier to prevent predicate pushdown leaks
DROP VIEW IF EXISTS public.cf_shield_configs_safe;

CREATE VIEW public.cf_shield_configs_safe
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  id, tracked_site_id, user_id, domain,
  cf_account_id, cf_zone_id, cf_worker_name, cf_route_pattern,
  deployment_mode, status, last_error, last_verified_at, deployed_at,
  human_sample_rate,
  hits_total, hits_last_24h, last_hit_at,
  created_at, updated_at,
  (cf_token_encrypted IS NOT NULL) AS has_token
FROM public.cf_shield_configs
WHERE auth.uid() = user_id;

GRANT SELECT ON public.cf_shield_configs_safe TO authenticated;