/**
 * canva-oauth-init — Initiate Canva OAuth 2.0 PKCE flow
 * Returns the authorization URL for the frontend to redirect to.
 *
 * POST { tracked_site_id?: string }
 * Returns { url: string, state: string }
 */
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize';

// Scopes aligned with Connect API capabilities
const SCOPES = [
  'asset:read',
  'asset:write',
  'design:content:read',
  'design:content:write',
  'design:meta:read',
  'brandtemplate:content:read',
  'brandtemplate:meta:read',
  'folder:read',
  'folder:write',
  'comment:write',
  'profile:read',
].join(' ');

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(buffer: Uint8Array): string {
  let str = '';
  for (const byte of buffer) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(handleRequest(async (req) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return jsonError('Unauthorized', 401);

  const body = await req.json().catch(() => ({}));
  const trackedSiteId = body.tracked_site_id || null;

  const clientId = Deno.env.get('CANVA_CLIENT_ID');
  if (!clientId) return jsonError('Canva integration not configured', 503);

  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/canva-oauth-callback`;

  // Generate PKCE pair
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // State contains user context (encrypted via simple encoding — tokens are short-lived)
  const statePayload = JSON.stringify({
    user_id: auth.userId,
    tracked_site_id: trackedSiteId,
    code_verifier: codeVerifier,
    ts: Date.now(),
  });
  const state = btoa(statePayload);

  // Store state temporarily in DB for callback validation
  await auth.supabase.from('canva_connections').upsert({
    user_id: auth.userId,
    tracked_site_id: trackedSiteId,
    status: 'pending',
    scopes: SCOPES.split(' '),
    // Store code_verifier temporarily in refresh_token field (will be overwritten on callback)
    refresh_token: codeVerifier,
  }, { onConflict: 'user_id,tracked_site_id' });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const url = `${CANVA_AUTH_URL}?${params.toString()}`;

  return jsonOk({ url, state });
}));
