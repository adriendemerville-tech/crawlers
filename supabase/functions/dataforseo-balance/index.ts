import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * dataforseo-balance — Fetches real-time DataForSEO account balance
 * GET /v3/appendix/user_data
 * Returns: balance, total deposited, and spending by endpoint
 */

Deno.serve(handleRequest(async (req) => {
  try {
    // Verify admin
    const supabase = getServiceClient();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonError('Unauthorized', 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return jsonError('Invalid token', 401);
    }

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return jsonError('Admin only', 403);
    }

    const login = Deno.env.get('DATAFORSEO_LOGIN');
    const password = Deno.env.get('DATAFORSEO_PASSWORD');
    if (!login || !password) {
      return jsonError('DataForSEO credentials not configured', 500);
    }

    const resp = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${login}:${password}`),
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[dataforseo-balance] API error:', resp.status, errText);
      return new Response(JSON.stringify({ error: `DataForSEO API error: ${resp.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const userData = data?.tasks?.[0]?.result?.[0];

    if (!userData) {
      return jsonError('No user data returned', 502);
    }

    const result = {
      balance: userData.money?.balance ?? null,
      total_deposited: userData.money?.total ?? null,
      total_spent: userData.money?.total != null && userData.money?.balance != null
        ? parseFloat((userData.money.total - userData.money.balance).toFixed(4))
        : null,
      login: userData.login ?? null,
      // Spending limits if available
      limits: userData.money?.limits ?? null,
      fetched_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[dataforseo-balance] error:', e);
    return jsonError(e instanceof Error ? e.message : 'Unknown error', 500);
  }
}));