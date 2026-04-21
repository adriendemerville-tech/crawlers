/**
 * social-oauth-callback — Handles OAuth redirects from LinkedIn and Meta (Facebook/Instagram).
 * Exchanges authorization codes for access tokens and stores them in social_accounts.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonError } from '../_shared/serveHandler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REDIRECT_BASE = Deno.env.get('SUPABASE_URL') + '/functions/v1/social-oauth-callback';

async function exchangeLinkedInCode(code: string, redirectUri: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = Deno.env.get('LINKEDIN_CLIENT_ID')!;
  const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET')!;

  const resp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`LinkedIn token exchange failed: ${err}`);
  }

  return resp.json();
}

async function exchangeMetaCode(code: string, redirectUri: string): Promise<{ access_token: string; expires_in?: number }> {
  const appId = Deno.env.get('META_APP_ID')!;
  const appSecret = Deno.env.get('META_APP_SECRET')!;

  // Exchange code for short-lived token
  const resp = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?` + new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  }));

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Meta token exchange failed: ${err}`);
  }

  const shortLived = await resp.json();

  // Exchange for long-lived token (60 days)
  const longResp = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLived.access_token,
  }));

  if (longResp.ok) {
    const longLived = await longResp.json();
    return { access_token: longLived.access_token, expires_in: longLived.expires_in || 5184000 };
  }

  // Fallback to short-lived
  return shortLived;
}

async function getLinkedInProfile(accessToken: string): Promise<{ sub: string; name: string }> {
  const resp = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error('Failed to fetch LinkedIn profile');
  return resp.json();
}

async function getMetaPages(accessToken: string): Promise<{ id: string; name: string; access_token: string }[]> {
  const resp = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
  if (!resp.ok) throw new Error('Failed to fetch Meta pages');
  const data = await resp.json();
  return data.data || [];
}

async function getInstagramAccount(pageId: string, pageToken: string): Promise<{ id: string; name: string } | null> {
  const resp = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.instagram_business_account?.id) return null;

  const igResp = await fetch(`https://graph.facebook.com/v18.0/${data.instagram_business_account.id}?fields=id,name,username&access_token=${pageToken}`);
  if (!igResp.ok) return null;
  const ig = await igResp.json();
  return { id: ig.id, name: ig.username || ig.name || ig.id };
}

// This is a redirect endpoint, not a JSON API
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const platform = url.searchParams.get('platform');

  const APP_URL = Deno.env.get('APP_URL') || 'https://crawlers.fr';
  const errorRedirect = (msg: string) => Response.redirect(`${APP_URL}/app/social?oauth_error=${encodeURIComponent(msg)}`, 302);
  const successRedirect = (p: string) => Response.redirect(`${APP_URL}/app/social?oauth_success=${p}`, 302);

  if (error) return errorRedirect(error);
  if (!code || !state || !platform) return errorRedirect('Missing code, state or platform');

  const supabase = getServiceClient();

  try {
    // Validate state (CSRF protection)
    const { data: stateRow, error: stateErr } = await supabase
      .from('social_oauth_states' as any)
      .select('*')
      .eq('state', state)
      .eq('platform', platform)
      .single();

    if (stateErr || !stateRow) return errorRedirect('Invalid or expired state');

    const userId = (stateRow as any).user_id;
    const trackedSiteId = (stateRow as any).tracked_site_id;

    // Delete used state
    await supabase.from('social_oauth_states' as any).delete().eq('state', state);

    // Check expiry
    if (new Date((stateRow as any).expires_at) < new Date()) return errorRedirect('OAuth state expired');

    const redirectUri = `${REDIRECT_BASE}?platform=${platform}`;

    if (platform === 'linkedin') {
      const tokens = await exchangeLinkedInCode(code, redirectUri);
      const profile = await getLinkedInProfile(tokens.access_token);

      await supabase.from('social_accounts' as any).upsert({
        user_id: userId,
        platform: 'linkedin',
        account_id: profile.sub,
        account_name: profile.name,
        page_id: profile.sub,
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: ['openid', 'profile', 'w_member_social'],
        status: 'active',
        tracked_site_id: trackedSiteId,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id,platform' });

      return successRedirect('linkedin');
    }

    if (platform === 'facebook' || platform === 'instagram') {
      const tokens = await exchangeMetaCode(code, redirectUri);
      const pages = await getMetaPages(tokens.access_token);

      if (pages.length === 0) return errorRedirect('No Facebook pages found. Make sure you have a page connected to your account.');

      // Use first page (could be improved with a page picker)
      const page = pages[0];

      // Save Facebook page
      await supabase.from('social_accounts' as any).upsert({
        user_id: userId,
        platform: 'facebook',
        account_id: page.id,
        account_name: page.name,
        page_id: page.id,
        access_token: page.access_token, // Page token (long-lived)
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 5184000) * 1000).toISOString(),
        scopes: ['pages_manage_posts', 'pages_read_engagement'],
        status: 'active',
        tracked_site_id: trackedSiteId,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id,platform' });

      // Also check for Instagram business account
      const igAccount = await getInstagramAccount(page.id, page.access_token);
      if (igAccount) {
        await supabase.from('social_accounts' as any).upsert({
          user_id: userId,
          platform: 'instagram',
          account_id: igAccount.id,
          account_name: igAccount.name,
          page_id: igAccount.id,
          access_token: page.access_token,
          token_expires_at: new Date(Date.now() + (tokens.expires_in || 5184000) * 1000).toISOString(),
          scopes: ['instagram_basic', 'instagram_content_publish'],
          status: 'active',
          tracked_site_id: trackedSiteId,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'user_id,platform' });
      }

      return successRedirect(platform);
    }

    return errorRedirect('Unknown platform');
  } catch (e) {
    console.error('[social-oauth-callback] Error:', e);
    return errorRedirect(e instanceof Error ? e.message : 'Unknown error');
  }
});
