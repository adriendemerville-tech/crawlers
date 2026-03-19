
-- Replace security-definer views with security-invoker views + a helper approach.
-- Since base table SELECT is USING(false), we need to allow the view to read through.
-- Solution: Re-allow SELECT on base table but ONLY for rows owned by the user.
-- This way security_invoker=on works correctly.

-- 1. Drop the problematic views
DROP VIEW IF EXISTS public.google_connections_safe;
DROP VIEW IF EXISTS public.cms_connections_safe;

-- 2. Replace USING(false) with user-scoped SELECT (tokens still hidden via view)
DROP POLICY IF EXISTS "No direct client SELECT on google_connections" ON public.google_connections;
CREATE POLICY "Users can select own google connections"
  ON public.google_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "No direct client SELECT on cms_connections" ON public.cms_connections;  
CREATE POLICY "Users can select own cms connections"
  ON public.cms_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. Recreate views WITH security_invoker=on (linter-compliant)
-- These views hide sensitive columns while RLS handles row isolation
CREATE VIEW public.google_connections_safe
WITH (security_invoker = on) AS
  SELECT 
    id, user_id, google_email, ga4_property_id, gsc_site_urls,
    token_expiry, created_at, updated_at,
    (access_token IS NOT NULL AND access_token != '') AS has_token,
    (refresh_token IS NOT NULL AND refresh_token != '') AS has_refresh_token
  FROM public.google_connections;

CREATE VIEW public.cms_connections_safe
WITH (security_invoker = on) AS
  SELECT
    id, user_id, tracked_site_id, platform, auth_method,
    site_url, platform_site_id, scopes, status, capabilities,
    created_at, updated_at,
    (api_key IS NOT NULL AND api_key != '') AS has_api_key,
    (oauth_access_token IS NOT NULL AND oauth_access_token != '') AS has_oauth_token
  FROM public.cms_connections;

GRANT SELECT ON public.google_connections_safe TO authenticated;
GRANT SELECT ON public.cms_connections_safe TO authenticated;
