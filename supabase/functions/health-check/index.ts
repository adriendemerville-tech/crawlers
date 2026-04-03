import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
  const start = Date.now();
  const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};

  // 1. Database connectivity
  try {
    const dbStart = Date.now();
    const supabase = getServiceClient();
    const { error } = await supabase.from('profiles').select('user_id').limit(1);
    checks.database = { ok: !error, ms: Date.now() - dbStart, ...(error && { error: error.message }) };
  } catch (e) {
    checks.database = { ok: false, ms: Date.now() - start, error: String(e) };
  }

  // 2. Check critical secrets
  const secrets = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'LOVABLE_API_KEY', 'STRIPE_SECRET_KEY'];
  const missingSecrets = secrets.filter(s => !Deno.env.get(s));
  checks.secrets = { ok: missingSecrets.length === 0, ms: 0, ...(missingSecrets.length > 0 && { error: `Missing: ${missingSecrets.length}` }) };

  // 3. Database size
  try {
    const supabase = getServiceClient();
    const { data } = await supabase.rpc('get_database_size');
    checks.storage = { ok: true, ms: 0, ...(data && { error: `${(data as any).total_mb}MB` }) };
  } catch (_) {
    checks.storage = { ok: true, ms: 0 };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  const totalMs = Date.now() - start;

  return new Response(JSON.stringify({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    response_time_ms: totalMs,
    checks,
  }), {
    status: allOk ? 200 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}));