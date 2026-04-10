/**
 * canva-api-proxy — Proxy authenticated requests to Canva Connect API
 * Handles automatic token refresh when expired.
 *
 * POST { action: string, tracked_site_id?: string, params?: any }
 *
 * Actions:
 *   - list_designs: List user designs
 *   - get_design: Get design details { design_id }
 *   - list_templates: List brand templates
 *   - create_design: Create design from template { template_id, title }
 *   - export_design: Export design { design_id, format }
 *   - upload_asset: Upload asset { name, data_url }
 *   - list_folders: List folders
 *   - get_user: Get Canva user profile
 *   - disconnect: Disconnect Canva account
 */
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

const CANVA_API = 'https://api.canva.com/rest/v1';
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

interface CanvaConnection {
  id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
}

async function getConnection(supabase: any, userId: string, trackedSiteId?: string): Promise<CanvaConnection | null> {
  let query = supabase
    .from('canva_connections')
    .select('id, access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (trackedSiteId) {
    query = query.eq('tracked_site_id', trackedSiteId);
  }

  const { data } = await query.limit(1).single();
  return data;
}

async function refreshTokenIfNeeded(supabase: any, conn: CanvaConnection): Promise<string> {
  const expiresAt = new Date(conn.token_expires_at).getTime();
  const now = Date.now();

  // Refresh if token expires within 5 minutes
  if (expiresAt - now > 5 * 60 * 1000) {
    return conn.access_token;
  }

  const clientId = Deno.env.get('CANVA_CLIENT_ID')!;
  const clientSecret = Deno.env.get('CANVA_CLIENT_SECRET')!;

  const res = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
    }),
  });

  if (!res.ok) {
    // Mark connection as expired
    await supabase.from('canva_connections').update({ status: 'expired' }).eq('id', conn.id);
    throw new Error('Token refresh failed — please reconnect Canva');
  }

  const tokens = await res.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

  await supabase.from('canva_connections').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || conn.refresh_token,
    token_expires_at: newExpiresAt,
  }).eq('id', conn.id);

  return tokens.access_token;
}

async function canvaFetch(token: string, path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${CANVA_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Canva API error: ${body}`), { status: res.status });
  }

  return res.json();
}

Deno.serve(handleRequest(async (req) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return jsonError('Unauthorized', 401);

  const body = await req.json();
  const { action, tracked_site_id, params = {} } = body;

  if (!action) return jsonError('Missing action', 400);

  const supabase = getServiceClient();

  // Handle disconnect separately
  if (action === 'disconnect') {
    await supabase
      .from('canva_connections')
      .update({ status: 'disconnected', access_token: null, refresh_token: null })
      .eq('user_id', auth.userId)
      .eq(tracked_site_id ? 'tracked_site_id' : 'user_id', tracked_site_id || auth.userId);
    return jsonOk({ success: true });
  }

  // Get active connection
  const conn = await getConnection(supabase, auth.userId, tracked_site_id);
  if (!conn) return jsonError('No active Canva connection. Please connect your Canva account.', 403);

  // Refresh token if needed
  const token = await refreshTokenIfNeeded(supabase, conn);

  // Route actions
  switch (action) {
    case 'get_user': {
      const data = await canvaFetch(token, '/users/me');
      return jsonOk(data);
    }

    case 'list_designs': {
      const query = params.query ? `?query=${encodeURIComponent(params.query)}` : '';
      const data = await canvaFetch(token, `/designs${query}`);
      return jsonOk(data);
    }

    case 'get_design': {
      if (!params.design_id) return jsonError('Missing design_id', 400);
      const data = await canvaFetch(token, `/designs/${params.design_id}`);
      return jsonOk(data);
    }

    case 'list_templates': {
      const data = await canvaFetch(token, '/brand-templates');
      return jsonOk(data);
    }

    case 'create_design': {
      const data = await canvaFetch(token, '/designs', {
        method: 'POST',
        body: JSON.stringify({
          design_type: params.design_type || 'Presentation',
          title: params.title || 'Untitled',
          ...(params.template_id && { brand_template_id: params.template_id }),
        }),
      });
      return jsonOk(data);
    }

    case 'export_design': {
      if (!params.design_id) return jsonError('Missing design_id', 400);
      const data = await canvaFetch(token, `/designs/${params.design_id}/exports`, {
        method: 'POST',
        body: JSON.stringify({
          format: params.format || 'png',
          ...(params.pages && { pages: params.pages }),
        }),
      });
      return jsonOk(data);
    }

    case 'get_export': {
      if (!params.export_id) return jsonError('Missing export_id', 400);
      const data = await canvaFetch(token, `/exports/${params.export_id}`);
      return jsonOk(data);
    }

    case 'upload_asset': {
      if (!params.name) return jsonError('Missing asset name', 400);
      const data = await canvaFetch(token, '/assets', {
        method: 'POST',
        body: JSON.stringify({
          name: params.name,
          ...(params.folder_id && { folder_id: params.folder_id }),
        }),
      });
      return jsonOk(data);
    }

    case 'list_folders': {
      const data = await canvaFetch(token, '/folders');
      return jsonOk(data);
    }

    case 'autofill': {
      if (!params.template_id || !params.data) return jsonError('Missing template_id or data', 400);
      const data = await canvaFetch(token, `/designs/autofill`, {
        method: 'POST',
        body: JSON.stringify({
          brand_template_id: params.template_id,
          data: params.data,
          title: params.title || 'Autofilled design',
        }),
      });
      return jsonOk(data);
    }

    default:
      return jsonError(`Unknown action: ${action}`, 400);
  }
}));
