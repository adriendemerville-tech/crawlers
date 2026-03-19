
-- CMS platform enum (WordPress, Shopify, Webflow, Wix, Drupal)
CREATE TYPE public.cms_platform AS ENUM ('wordpress', 'shopify', 'webflow', 'wix', 'drupal');

-- CMS connections table
CREATE TABLE public.cms_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  platform cms_platform NOT NULL,
  auth_method text NOT NULL DEFAULT 'oauth2' CHECK (auth_method IN ('oauth2', 'basic', 'api_key')),
  oauth_access_token text,
  oauth_refresh_token text,
  token_expiry timestamptz,
  basic_auth_user text,
  basic_auth_pass text,
  api_key text,
  site_url text NOT NULL,
  platform_site_id text,
  scopes text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'pending')),
  capabilities jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tracked_site_id, platform)
);

-- RLS
ALTER TABLE public.cms_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own CMS connections"
  ON public.cms_connections FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own CMS connections"
  ON public.cms_connections FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own CMS connections"
  ON public.cms_connections FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own CMS connections"
  ON public.cms_connections FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Auto-update updated_at
CREATE TRIGGER update_cms_connections_updated_at
  BEFORE UPDATE ON public.cms_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
