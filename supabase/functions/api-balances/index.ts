import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * api-balances — Fetches real-time balance/usage for SerpAPI, OpenRouter, Firecrawl
 * Admin-only endpoint returning all API balances in one call
 */

Deno.serve(handleRequest(async (req) => {
  try {
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

    // Fetch all balances in parallel
    const [serpapi, openrouter, firecrawl] = await Promise.allSettled([
      fetchSerpApiBalance(),
      fetchOpenRouterBalance(),
      fetchFirecrawlBalance(),
    ]);

    const result = {
      serpapi: serpapi.status === 'fulfilled' ? serpapi.value : { error: (serpapi as PromiseRejectedResult).reason?.message },
      openrouter: openrouter.status === 'fulfilled' ? openrouter.value : { error: (openrouter as PromiseRejectedResult).reason?.message },
      firecrawl: firecrawl.status === 'fulfilled' ? firecrawl.value : { error: (firecrawl as PromiseRejectedResult).reason?.message },
      fetched_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api-balances] error:', e);
    return jsonError(e instanceof Error ? e.message : 'Unknown error', 500);
  }
}));

// ── SerpAPI ──────────────────────────────────────────────
// GET https://serpapi.com/account.json?api_key=XXX
async function fetchSerpApiBalance() {
  const apiKey = Deno.env.get('SERPAPI_KEY');
  if (!apiKey) return { error: 'SERPAPI_KEY not configured' };

  const resp = await fetch(`https://serpapi.com/account.json?api_key=${apiKey}`);
  if (!resp.ok) {
    const text = await resp.text();
    console.error('[api-balances] SerpAPI error:', resp.status, text);
    return { error: `SerpAPI error: ${resp.status}` };
  }

  const data = await resp.json();
  return {
    plan: data.plan_name ?? null,
    searches_this_month: data.this_month_usage ?? null,
    total_searches_left: data.total_searches_left ?? null,
    plan_searches_left: data.plan_searches_left ?? null,
    account_email: data.account_email ?? null,
  };
}

// ── OpenRouter ───────────────────────────────────────────
// GET https://openrouter.ai/api/v1/auth/key
async function fetchOpenRouterBalance() {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) return { error: 'OPENROUTER_API_KEY not configured' };

  const resp = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.error('[api-balances] OpenRouter error:', resp.status, text);
    return { error: `OpenRouter error: ${resp.status}` };
  }

  const data = await resp.json();
  const keyData = data?.data;
  return {
    label: keyData?.label ?? null,
    usage: keyData?.usage ?? null, // in USD
    limit: keyData?.limit ?? null, // in USD, null = unlimited
    is_free_tier: keyData?.is_free_tier ?? null,
    rate_limit: keyData?.rate_limit ?? null,
    balance: keyData?.limit != null && keyData?.usage != null
      ? parseFloat((keyData.limit - keyData.usage).toFixed(4))
      : null,
  };
}

// ── Firecrawl ────────────────────────────────────────────
// GET https://api.firecrawl.dev/v1/team/credits
async function fetchFirecrawlBalance() {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) return { error: 'FIRECRAWL_API_KEY not configured' };

  const resp = await fetch('https://api.firecrawl.dev/v1/team/credits', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.error('[api-balances] Firecrawl error:', resp.status, text);
    return { error: `Firecrawl error: ${resp.status}` };
  }

  const data = await resp.json();
  return {
    remaining_credits: data.remaining_credits ?? data.credits ?? null,
    total_credits: data.total_credits ?? null,
    plan: data.plan ?? null,
    overage_credits: data.overage_credits ?? null,
  };
}