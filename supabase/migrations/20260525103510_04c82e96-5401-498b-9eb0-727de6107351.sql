-- Revoke column-level SELECT on sensitive secret/token columns from authenticated and anon roles.
-- RLS still allows row-scope, but these columns will never be returned to the client.
-- Edge Functions using service_role are unaffected.

REVOKE SELECT (ingestion_secret, cf_token_encrypted) ON public.cf_shield_configs FROM authenticated, anon;
REVOKE SELECT (access_token, refresh_token) ON public.google_connections FROM authenticated, anon;
REVOKE SELECT (oauth_access_token, oauth_refresh_token, api_key, basic_auth_pass) ON public.cms_connections FROM authenticated, anon;
REVOKE SELECT (access_token, refresh_token) ON public.canva_connections FROM authenticated, anon;
REVOKE SELECT (access_token, refresh_token) ON public.social_accounts FROM authenticated, anon;
REVOKE SELECT (tap_token_encrypted) ON public.firehose_taps FROM authenticated, anon;
REVOKE SELECT (api_key) ON public.tool_api_keys FROM authenticated, anon;