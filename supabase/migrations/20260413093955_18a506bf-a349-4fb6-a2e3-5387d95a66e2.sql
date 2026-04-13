
-- Revert the USING(false) policies back to owner-scoped SELECT
-- (Views need the underlying SELECT to work with security_invoker)

-- google_connections
DROP POLICY IF EXISTS "No direct SELECT on google_connections" ON public.google_connections;
CREATE POLICY "Users can view own google connections"
  ON public.google_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- google_ads_connections
DROP POLICY IF EXISTS "No direct SELECT on google_ads_connections" ON public.google_ads_connections;
CREATE POLICY "Users can view own google ads connections"
  ON public.google_ads_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- social_accounts
DROP POLICY IF EXISTS "No direct SELECT on social_accounts" ON public.social_accounts;
CREATE POLICY "Users can view own social accounts"
  ON public.social_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- cms_connections
DROP POLICY IF EXISTS "No direct SELECT on cms_connections" ON public.cms_connections;
CREATE POLICY "Users can view own cms connections"
  ON public.cms_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- canva_connections
DROP POLICY IF EXISTS "No direct SELECT on canva_connections" ON public.canva_connections;
CREATE POLICY "Users can view own canva connections"
  ON public.canva_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- matomo_connections
DROP POLICY IF EXISTS "No direct SELECT on matomo_connections" ON public.matomo_connections;
CREATE POLICY "Users can view own matomo connections"
  ON public.matomo_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- tool_api_keys
DROP POLICY IF EXISTS "No direct SELECT on tool_api_keys" ON public.tool_api_keys;
CREATE POLICY "Users can view own tool api keys"
  ON public.tool_api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- marina_api_keys
DROP POLICY IF EXISTS "No direct SELECT on marina_api_keys" ON public.marina_api_keys;
CREATE POLICY "Users can view own marina api keys"
  ON public.marina_api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- magic_links — keep blocked, no client reads needed
DROP POLICY IF EXISTS "No direct SELECT on magic_links" ON public.magic_links;
CREATE POLICY "No user SELECT on magic_links"
  ON public.magic_links FOR SELECT
  TO authenticated
  USING (false);
