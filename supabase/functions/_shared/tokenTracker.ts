/**
 * Tracks AI token usage by inserting into analytics_events.
 * Uses singleton service client for connection reuse under high load.
 */
import { getServiceClient } from './supabaseClient.ts';

export async function trackTokenUsage(
  functionName: string,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined,
  targetUrl?: string,
) {
  if (!usage) return;

  try {
    const supabase = getServiceClient();
    await supabase.from('analytics_events').insert({
      event_type: 'ai_token_usage',
      url: targetUrl || null,
      event_data: {
        function_name: functionName,
        model,
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
      },
    });
  } catch (e) {
    console.error('[tokenTracker] Failed:', e);
  }
}

/**
 * Tracks a paid API call (DataForSEO, Google APIs, etc.)
 */
export async function trackPaidApiCall(
  functionName: string,
  apiService: string,
  endpoint: string,
  targetUrl?: string,
) {
  try {
    const supabase = getServiceClient();
    await supabase.from('analytics_events').insert({
      event_type: 'paid_api_call',
      url: targetUrl || null,
      event_data: {
        function_name: functionName,
        api_service: apiService,
        endpoint,
      },
    });
  } catch (e) {
    console.error('[tokenTracker] Failed:', e);
  }
}

/**
 * Tracks an edge function error for admin dashboard visibility.
 * Fire-and-forget — never throws.
 */
export async function trackEdgeFunctionError(
  functionName: string,
  errorMessage: string,
  context?: {
    url?: string;
    user_id?: string;
    domain?: string;
    status_code?: number;
    details?: string;
  },
) {
  try {
    const supabase = getServiceClient();
    await supabase.from('analytics_events').insert({
      event_type: 'edge_function_error',
      user_id: context?.user_id || null,
      url: context?.url || null,
      event_data: {
        function_name: functionName,
        error_message: errorMessage,
        domain: context?.domain || null,
        status_code: context?.status_code || 500,
        details: context?.details || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[trackEdgeFunctionError] Failed:', e);
  }
}
