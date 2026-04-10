/**
 * canva-oauth-callback — Handle Canva OAuth callback
 * Exchanges authorization code for tokens and stores them.
 *
 * GET ?code=...&state=...
 * Redirects back to the app on success/failure.
 */
import { handleRequest, jsonError } from '../_shared/serveHandler.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
const CANVA_USER_URL = 'https://api.canva.com/rest/v1/users/me';

Deno.serve(handleRequest(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Determine app redirect base
  const appUrl = Deno.env.get('APP_URL') || 'https://crawlers.lovable.app';

  if (error) {
    return Response.redirect(`${appUrl}/app/social?canva_error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !stateParam) {
    return Response.redirect(`${appUrl}/app/social?canva_error=missing_params`, 302);
  }

  // Decode state
  let stateData: { user_id: string; tracked_site_id: string | null; code_verifier: string; ts: number };
  try {
    stateData = JSON.parse(atob(stateParam));
  } catch {
    return Response.redirect(`${appUrl}/app/social?canva_error=invalid_state`, 302);
  }

  // Validate timestamp (10 min max)
  if (Date.now() - stateData.ts > 10 * 60 * 1000) {
    return Response.redirect(`${appUrl}/app/social?canva_error=expired`, 302);
  }

  const clientId = Deno.env.get('CANVA_CLIENT_ID');
  const clientSecret = Deno.env.get('CANVA_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return Response.redirect(`${appUrl}/app/social?canva_error=not_configured`, 302);
  }

  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/canva-oauth-callback`;

  // Exchange code for tokens
  const tokenRes = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: stateData.code_verifier,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error('[canva-oauth-callback] Token exchange failed:', errBody);
    return Response.redirect(`${appUrl}/app/social?canva_error=token_exchange_failed`, 302);
  }

  const tokens = await tokenRes.json();

  // Fetch Canva user profile
  let canvaUser: { id?: string; display_name?: string; team_id?: string } = {};
  try {
    const userRes = await fetch(CANVA_USER_URL, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });
    if (userRes.ok) {
      canvaUser = await userRes.json();
    }
  } catch (e) {
    console.warn('[canva-oauth-callback] Could not fetch Canva user profile:', e);
  }

  // Store tokens
  const supabase = getServiceClient();
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

  const { error: dbError } = await supabase
    .from('canva_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      canva_user_id: canvaUser.id || null,
      canva_team_id: canvaUser.team_id || null,
      display_name: canvaUser.display_name || null,
      status: 'active',
    })
    .eq('user_id', stateData.user_id)
    .eq(stateData.tracked_site_id ? 'tracked_site_id' : 'user_id', stateData.tracked_site_id || stateData.user_id);

  if (dbError) {
    console.error('[canva-oauth-callback] DB update failed:', dbError);
    return Response.redirect(`${appUrl}/app/social?canva_error=db_error`, 302);
  }

  return Response.redirect(`${appUrl}/app/social?canva_connected=true`, 302);
}));
