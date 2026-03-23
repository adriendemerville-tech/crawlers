import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * dataforseo-balance — Fetches real-time DataForSEO account balance
 * GET /v3/appendix/user_data
 * Returns: balance, total deposited, and spending by endpoint
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const supabase = getServiceClient();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const login = Deno.env.get('DATAFORSEO_LOGIN');
    const password = Deno.env.get('DATAFORSEO_PASSWORD');
    if (!login || !password) {
      return new Response(JSON.stringify({ error: 'DataForSEO credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'No user data returned' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
