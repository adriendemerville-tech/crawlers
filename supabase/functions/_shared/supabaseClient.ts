/**
 * Singleton Supabase clients — avoids creating new instances on every call.
 * Reuses connections for better performance under high concurrency.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

let _serviceClient: SupabaseClient | null = null;
let _anonClient: SupabaseClient | null = null;

/**
 * Get a singleton service-role client (bypasses RLS).
 * Safe to reuse across requests in the same isolate.
 */
export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    _serviceClient = createClient(url, key);
  }
  return _serviceClient;
}

/**
 * Get a singleton anon client (respects RLS).
 */
export function getAnonClient(): SupabaseClient {
  if (!_anonClient) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    _anonClient = createClient(url, key);
  }
  return _anonClient;
}

/**
 * Create a per-request client scoped to a user's auth token.
 * NOT a singleton — each request gets its own.
 */
export function getUserClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}
