/**
 * Audit Cache — avoids re-paying IA for identical requests within TTL.
 * Used by Edge Functions via service role key.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Build a deterministic cache key from function name + params.
 */
export function cacheKey(functionName: string, params: Record<string, any>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${JSON.stringify(params[k])}`).join('&');
  return `${functionName}:${sorted}`;
}

/**
 * Get cached result if still valid (not expired).
 */
export async function getCached(key: string): Promise<any | null> {
  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('audit_cache')
      .select('result_data')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;
    return data.result_data;
  } catch {
    return null;
  }
}

/**
 * Store result in cache with a TTL (default 1 hour).
 */
export async function setCache(
  key: string,
  functionName: string,
  result: any,
  ttlMinutes = 60,
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  try {
    await supabase
      .from('audit_cache')
      .upsert({
        cache_key: key,
        function_name: functionName,
        result_data: result,
        expires_at: expiresAt,
      }, { onConflict: 'cache_key' });
  } catch (e) {
    console.error('[auditCache] set error:', e);
  }
}

/**
 * Check rate limit for a user+action combo.
 * Returns { allowed: boolean, current_count, limit }
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  maxCount = 10,
  windowMinutes = 60,
): Promise<{ allowed: boolean; current_count: number; limit: number }> {
  const supabase = getClient();
  if (!supabase) return { allowed: true, current_count: 0, limit: maxCount };

  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_action: action,
      p_max_count: maxCount,
      p_window_minutes: windowMinutes,
    });

    if (error) {
      console.error('[rateLimit] error:', error);
      return { allowed: true, current_count: 0, limit: maxCount };
    }

    return data as { allowed: boolean; current_count: number; limit: number };
  } catch {
    return { allowed: true, current_count: 0, limit: maxCount };
  }
}
