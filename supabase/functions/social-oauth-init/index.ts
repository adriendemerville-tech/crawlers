/**
 * social-oauth-init — Generates OAuth authorization URLs for LinkedIn, Facebook/Instagram.
 * Redirects the user to the platform's consent screen.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const REDIRECT_BASE = Deno.env.get('SUPABASE_URL') + '/functions/v1/social-oauth-callback';

interface OAuthConfig {
  authorizeUrl: string;
  clientId: string;
  scopes: string[];
  extraParams?: Record<string, string>;
}

function getOAuthConfig(platform: string): OAuthConfig | null {
  if (platform === 'linkedin') {
    const clientId = Deno.env.get('LINKEDIN_CLIENT_ID');
    if (!clientId) return null;
    return {
      authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      clientId,
      scopes: ['openid', 'profile', 'w_member_social'],
    };
  }

  if (platform === 'facebook' || platform === 'instagram') {
    const clientId = Deno.env.get('META_APP_ID');
    if (!clientId) return null;
    const scopes = platform === 'instagram'
      ? ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement']
      : ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'public_profile'];
    return {
      authorizeUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      clientId,
      scopes,
    };
  }

  return null;
}

Deno.serve(handleRequest(async (req) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return jsonError('Unauthorized', 401);

  const { platform, tracked_site_id } = await req.json();
  if (!platform || !['linkedin', 'facebook', 'instagram'].includes(platform)) {
    return jsonError('Invalid platform. Use: linkedin, facebook, instagram');
  }

  const config = getOAuthConfig(platform);
  if (!config) return jsonError(`${platform} OAuth not configured — missing client ID`, 500);

  // Store state in DB for CSRF protection
  const state = crypto.randomUUID();
  const supabase = getServiceClient();

  await supabase.from('social_oauth_states' as any).insert({
    state,
    user_id: auth.userId,
    platform,
    tracked_site_id: tracked_site_id || null,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
  });

  const redirectUri = `${REDIRECT_BASE}?platform=${platform}`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    state,
    scope: config.scopes.join(' '),
    ...config.extraParams,
  });

  const authUrl = `${config.authorizeUrl}?${params.toString()}`;

  return jsonOk({ auth_url: authUrl, state });
}, 'social-oauth-init'));
