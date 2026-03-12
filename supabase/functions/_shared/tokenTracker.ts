/**
 * Tracks AI token usage by inserting into analytics_events.
 * Uses SERVICE_ROLE_KEY to bypass RLS and avoid silent data loss.
 */
export async function trackTokenUsage(
  functionName: string,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined,
  targetUrl?: string,
) {
  if (!usage) return;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseKey) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        event_type: 'ai_token_usage',
        url: targetUrl || null,
        event_data: {
          function_name: functionName,
          model,
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
        },
      }),
    });
  } catch (e) {
    console.error('[tokenTracker] Failed:', e);
  }
}

/**
 * Tracks a paid API call (DataForSEO, Google APIs, etc.)
 * Uses SERVICE_ROLE_KEY to bypass RLS and avoid silent data loss.
 */
export async function trackPaidApiCall(
  functionName: string,
  apiService: string,
  endpoint: string,
  targetUrl?: string,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseKey) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        event_type: 'paid_api_call',
        url: targetUrl || null,
        event_data: {
          function_name: functionName,
          api_service: apiService,
          endpoint,
        },
      }),
    });
  } catch (e) {
    console.error('[tokenTracker] Failed:', e);
  }
}
