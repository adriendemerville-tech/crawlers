-- Expand auth_method check to include 'internal'
ALTER TABLE public.cms_connections DROP CONSTRAINT cms_connections_auth_method_check;
ALTER TABLE public.cms_connections ADD CONSTRAINT cms_connections_auth_method_check 
  CHECK (auth_method = ANY (ARRAY['oauth2'::text, 'basic'::text, 'api_key'::text, 'internal'::text]));

-- Insert CMS connection for crawlers.fr
INSERT INTO public.cms_connections (
  user_id, tracked_site_id, platform, site_url, auth_method, status, capabilities
) VALUES (
  '51082f81-8971-4278-b70f-c1e880d2a934',
  'a4b69db4-e7b0-4e9b-9e87-3ce2c90d4bc1',
  'crawlers_internal',
  'https://crawlers.fr',
  'internal',
  'active',
  '{"create_post":true,"update_post":true,"delete_post":true,"create_page":true,"update_page":true,"update_meta":true,"inject_code":true}'::jsonb
);