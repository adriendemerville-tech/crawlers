// Parménion API — pull model: client site polls for pending content tasks
// and reports back when published or failed.
//
// Endpoints (all under /functions/v1/parmenion-api):
//   GET    /v1/health
//   GET    /v1/tasks/pending?limit=10
//   POST   /v1/tasks/{id}/ack
//   POST   /v1/tasks/{id}/published   body: { url, cms_post_id?, notes? }
//   POST   /v1/tasks/{id}/failed      body: { error_message, error_category? }
//
// Auth: header `Authorization: Bearer prm_live_xxx` OR `x-parmenion-key: prm_live_xxx`

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-parmenion-key, content-type, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function extractToken(req: Request): string | null {
  const auth = req.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const x = req.headers.get('x-parmenion-key');
  if (x) return x.trim();
  return null;
}

async function verifyToken(token: string) {
  const { data, error } = await admin.rpc('parmenion_verify_pull_token', { _token: token });
  if (error || !data || data.length === 0) return null;
  const row = data[0] as {
    target_id: string;
    domain: string;
    is_active: boolean;
    autopilot_enabled: boolean;
  };
  if (!row.is_active) return null;
  return row;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  // Strip "/parmenion-api" prefix the gateway prepends, keep "/v1/..."
  const path = url.pathname.replace(/^\/parmenion-api/, '') || '/';

  // Public health
  if (req.method === 'GET' && path === '/v1/health') {
    return json({ ok: true, service: 'parmenion-api', version: 'v1', time: new Date().toISOString() });
  }

  // Auth
  const token = extractToken(req);
  if (!token) return json({ error: 'missing_token', message: 'Authorization: Bearer <token> required' }, 401);
  const target = await verifyToken(token);
  if (!target)
    return json({ error: 'invalid_token', message: 'Token invalid, revoked, or target inactive' }, 401);

  // GET /v1/tasks/pending
  if (req.method === 'GET' && path === '/v1/tasks/pending') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 50);
    const { data, error } = await admin
      .from('parmenion_decision_log')
      .select(
        'id, domain, action_type, action_payload, goal_description, goal_type, pipeline_phase, cycle_number, created_at',
      )
      .eq('domain', target.domain)
      .eq('status', 'planned')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) return json({ error: 'db_error', message: error.message }, 500);
    return json({
      target: { id: target.target_id, domain: target.domain },
      count: data?.length || 0,
      tasks: (data || []).map((t) => ({
        id: t.id,
        action_type: t.action_type,
        goal: t.goal_description,
        goal_type: t.goal_type,
        phase: t.pipeline_phase,
        cycle: t.cycle_number,
        created_at: t.created_at,
        payload: t.action_payload,
      })),
    });
  }

  // POST /v1/tasks/{id}/{verb}
  const m = path.match(/^\/v1\/tasks\/([0-9a-f-]{36})\/(ack|published|failed)$/i);
  if (req.method === 'POST' && m) {
    const taskId = m[1];
    const verb = m[2] as 'ack' | 'published' | 'failed';

    // Confirm the task belongs to this target's domain
    const { data: task, error: taskErr } = await admin
      .from('parmenion_decision_log')
      .select('id, status, domain, execution_results')
      .eq('id', taskId)
      .eq('domain', target.domain)
      .maybeSingle();
    if (taskErr) return json({ error: 'db_error', message: taskErr.message }, 500);
    if (!task) return json({ error: 'not_found', message: 'Task not found for this target' }, 404);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const now = new Date().toISOString();
    const prev = (task.execution_results as Record<string, unknown>) || {};

    if (verb === 'ack') {
      const { error } = await admin
        .from('parmenion_decision_log')
        .update({
          status: 'in_progress',
          execution_started_at: now,
          execution_results: { ...prev, ack_at: now, source: 'pull_api' },
          updated_at: now,
        })
        .eq('id', taskId);
      if (error) return json({ error: 'db_error', message: error.message }, 500);
      return json({ ok: true, id: taskId, status: 'in_progress' });
    }

    if (verb === 'published') {
      const publishedUrl = typeof body.url === 'string' ? body.url : null;
      if (!publishedUrl) return json({ error: 'invalid_body', message: '`url` is required' }, 400);
      const { error } = await admin
        .from('parmenion_decision_log')
        .update({
          status: 'completed',
          execution_completed_at: now,
          execution_results: {
            ...prev,
            published_url: publishedUrl,
            cms_post_id: body.cms_post_id ?? null,
            notes: body.notes ?? null,
            source: 'pull_api',
            completed_at: now,
          },
          updated_at: now,
        })
        .eq('id', taskId);
      if (error) return json({ error: 'db_error', message: error.message }, 500);
      return json({ ok: true, id: taskId, status: 'completed', published_url: publishedUrl });
    }

    if (verb === 'failed') {
      const msg = typeof body.error_message === 'string' ? body.error_message : 'unknown error';
      const cat = typeof body.error_category === 'string' ? body.error_category : 'client_failure';
      const { error } = await admin
        .from('parmenion_decision_log')
        .update({
          status: 'error',
          is_error: true,
          error_category: cat,
          execution_error: msg,
          execution_completed_at: now,
          execution_results: { ...prev, source: 'pull_api', failed_at: now, error_message: msg },
          updated_at: now,
        })
        .eq('id', taskId);
      if (error) return json({ error: 'db_error', message: error.message }, 500);
      return json({ ok: true, id: taskId, status: 'error' });
    }
  }

  return json({ error: 'not_found', message: `No route for ${req.method} ${path}` }, 404);
});
