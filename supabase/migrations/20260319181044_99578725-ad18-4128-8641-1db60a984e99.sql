
-- Fix views: security_invoker=on won't work with USING(false) on base tables.
-- Recreate views WITHOUT security_invoker (they run as view owner = service role, bypassing RLS).
-- The GRANT on the view controls who can query it.

DROP VIEW IF EXISTS public.google_connections_safe;
CREATE VIEW public.google_connections_safe AS
  SELECT 
    id,
    user_id,
    google_email,
    ga4_property_id,
    gsc_site_urls,
    token_expiry,
    created_at,
    updated_at,
    CASE WHEN access_token IS NOT NULL AND access_token != '' THEN true ELSE false END AS has_token,
    CASE WHEN refresh_token IS NOT NULL AND refresh_token != '' THEN true ELSE false END AS has_refresh_token
  FROM public.google_connections;

DROP VIEW IF EXISTS public.cms_connections_safe;
CREATE VIEW public.cms_connections_safe AS
  SELECT
    id,
    user_id,
    tracked_site_id,
    platform,
    auth_method,
    site_url,
    platform_site_id,
    scopes,
    status,
    capabilities,
    created_at,
    updated_at,
    CASE WHEN api_key IS NOT NULL AND api_key != '' THEN true ELSE false END AS has_api_key,
    CASE WHEN oauth_access_token IS NOT NULL AND oauth_access_token != '' THEN true ELSE false END AS has_oauth_token
  FROM public.cms_connections;

-- Grant SELECT to authenticated
GRANT SELECT ON public.google_connections_safe TO authenticated;
GRANT SELECT ON public.cms_connections_safe TO authenticated;

-- Enable RLS-like filtering via the view itself by adding a security policy function
-- Since these are views (not tables), RLS doesn't apply directly.
-- Instead we add WHERE user_id = auth.uid() filters in the view definition.

-- Recreate with row-level filtering built in
DROP VIEW IF EXISTS public.google_connections_safe;
CREATE VIEW public.google_connections_safe AS
  SELECT 
    id,
    user_id,
    google_email,
    ga4_property_id,
    gsc_site_urls,
    token_expiry,
    created_at,
    updated_at,
    CASE WHEN access_token IS NOT NULL AND access_token != '' THEN true ELSE false END AS has_token,
    CASE WHEN refresh_token IS NOT NULL AND refresh_token != '' THEN true ELSE false END AS has_refresh_token
  FROM public.google_connections
  WHERE user_id = auth.uid();

DROP VIEW IF EXISTS public.cms_connections_safe;
CREATE VIEW public.cms_connections_safe AS
  SELECT
    id,
    user_id,
    tracked_site_id,
    platform,
    auth_method,
    site_url,
    platform_site_id,
    scopes,
    status,
    capabilities,
    created_at,
    updated_at,
    CASE WHEN api_key IS NOT NULL AND api_key != '' THEN true ELSE false END AS has_api_key,
    CASE WHEN oauth_access_token IS NOT NULL AND oauth_access_token != '' THEN true ELSE false END AS has_oauth_token
  FROM public.cms_connections
  WHERE user_id = auth.uid();

GRANT SELECT ON public.google_connections_safe TO authenticated;
GRANT SELECT ON public.cms_connections_safe TO authenticated;
