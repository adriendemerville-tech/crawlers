
-- ═══════════════════════════════════════════════════════════════
-- RLS HARDENING: Secure sensitive tables (tokens, credentials, API keys)
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. REVENUE_EVENTS: Fix the wide-open INSERT policy ───
-- Current INSERT policy has with_check=true, meaning ANY user (including anon) can insert.
-- Replace with service_role only (Edge Functions insert, not clients directly).
DROP POLICY IF EXISTS "Service role can insert revenue events" ON public.revenue_events;

CREATE POLICY "Service role can insert revenue events"
  ON public.revenue_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Add admin insert for manual corrections
CREATE POLICY "Admins can insert revenue events"
  ON public.revenue_events FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ─── 2. GOOGLE_CONNECTIONS: Create a safe view hiding tokens ───
-- The base table exposes access_token and refresh_token via SELECT to the owning user.
-- Frontend never queries this table directly, but let's protect it anyway.
-- Create a safe view for any future frontend usage.
CREATE OR REPLACE VIEW public.google_connections_safe
WITH (security_invoker = on) AS
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

-- ─── 3. CMS_CONNECTIONS: Create a safe view hiding credentials ───
CREATE OR REPLACE VIEW public.cms_connections_safe
WITH (security_invoker = on) AS
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

-- ─── 4. TRACKED_SITES: Add admin SELECT policy ───
CREATE POLICY "Admins can view all tracked sites"
  ON public.tracked_sites FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ─── 5. Ensure revenue_events cannot be updated/deleted by regular users ───
-- (No UPDATE/DELETE policies exist — this is correct behavior, only service_role can modify via Edge Functions)

-- ─── 6. Add admin SELECT for cms_connections ───
-- Already covered by existing policy (users can view own OR admin)

-- ─── 7. SITE_SCRIPT_RULES: Add admin read policy ───
CREATE POLICY "Admins can view all script rules"
  ON public.site_script_rules FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
