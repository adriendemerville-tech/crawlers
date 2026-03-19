
-- ═══════════════════════════════════════════════════════════════
-- LOCKDOWN: Deny direct SELECT on token tables, force _safe views
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. GOOGLE_CONNECTIONS: Block direct client SELECT ───
-- Backend uses service_role (bypasses RLS). Frontend never queries this table.
DROP POLICY IF EXISTS "Users can view own connections" ON public.google_connections;

CREATE POLICY "No direct client SELECT on google_connections"
  ON public.google_connections FOR SELECT
  USING (false);

-- ─── 2. CMS_CONNECTIONS: Restrict SELECT to id + safe columns only ───
-- Frontend only does .upsert().select('id') — the upsert returns the row via INSERT/UPDATE policies.
-- We block broad SELECT but keep INSERT/UPDATE/DELETE policies intact.
DROP POLICY IF EXISTS "Users can view own CMS connections" ON public.cms_connections;

CREATE POLICY "No direct client SELECT on cms_connections"
  ON public.cms_connections FOR SELECT
  TO authenticated
  USING (false);

-- Admin still needs access via service_role (bypasses RLS), so no admin policy needed on base table.

-- ─── 3. Add SELECT policies on the safe views (via security_invoker) ───
-- Views with security_invoker=on inherit the calling user's permissions.
-- Since base table SELECT is now USING(false), views need their own grants.
-- Grant SELECT on the views to authenticated users.
GRANT SELECT ON public.google_connections_safe TO authenticated;
GRANT SELECT ON public.cms_connections_safe TO authenticated;
