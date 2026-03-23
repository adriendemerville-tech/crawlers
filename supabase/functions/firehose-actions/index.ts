/**
 * firehose-actions — Proxy to Ahrefs Firehose API (api.firehose.com)
 * 
 * Actions:
 *   Management (requires FIREHOSE_MANAGEMENT_KEY):
 *     - list_taps, create_tap, get_tap, update_tap, revoke_tap
 *   Tap-level (requires tap token from DB):
 *     - list_rules, create_rule, get_rule, update_rule, delete_rule
 *     - stream (SSE proxy with DB persistence)
 *   Internal:
 *     - poll_stream (batch fetch & persist events for a tap)
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

const FIREHOSE_BASE = 'https://api.firehose.com';

// ── Helpers ──────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

async function requireAuth(req: Request) {
  const ah = req.headers.get('Authorization');
  if (!ah?.startsWith('Bearer ')) throw new Error('unauthorized');
  const sb = getUserClient(ah);
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) throw new Error('unauthorized');
  return { userId: user.id, authHeader: ah };
}

async function requireAdmin(userId: string) {
  const sb = getServiceClient();
  const { data } = await sb.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (data !== true) throw new Error('forbidden');
}

async function firehoseRequest(
  path: string,
  method: string,
  token: string,
  body?: unknown,
): Promise<{ data: unknown; status: number }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const opts: RequestInit = { method, headers };
  if (body && (method === 'POST' || method === 'PUT')) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${FIREHOSE_BASE}${path}`, opts);
  if (res.status === 204) return { data: null, status: 204 };
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { data: parsed, status: res.status };
}

function getMgmtKey(): string {
  const key = Deno.env.get('FIREHOSE_MANAGEMENT_KEY');
  if (!key) throw new Error('FIREHOSE_MANAGEMENT_KEY not configured');
  return key;
}

// ── Actions ──────────────────────────────────────────────

async function listTaps(userId: string) {
  const mgmtKey = getMgmtKey();
  const { data, status } = await firehoseRequest('/v1/taps', 'GET', mgmtKey);
  if (status !== 200) return err('Firehose API error', status);

  // Sync local DB
  const sb = getServiceClient();
  const taps = (data as any)?.data || [];
  for (const tap of taps) {
    await sb.from('firehose_taps').upsert({
      user_id: userId,
      tap_id: tap.id,
      tap_name: tap.name,
      token_prefix: tap.token_prefix,
      tap_token_encrypted: tap.token, // stored server-side only
      rules_count: tap.rules_count || 0,
      last_used_at: tap.last_used_at,
    }, { onConflict: 'tap_id' });
  }

  return json({ taps });
}

async function createTap(userId: string, body: { name: string; tracked_site_id?: string }) {
  const mgmtKey = getMgmtKey();
  const { data, status } = await firehoseRequest('/v1/taps', 'POST', mgmtKey, { name: body.name });
  if (status !== 201) return err('Failed to create tap', status);

  const tapData = (data as any)?.data;
  const token = (data as any)?.token;

  // Store in DB
  const sb = getServiceClient();
  const { error: dbErr } = await sb.from('firehose_taps').insert({
    user_id: userId,
    tracked_site_id: body.tracked_site_id || null,
    tap_id: tapData.id,
    tap_name: tapData.name,
    token_prefix: tapData.token_prefix,
    tap_token_encrypted: token,
    rules_count: 0,
  });

  if (dbErr) console.error('[firehose] DB insert error:', dbErr.message);

  return json({ tap: tapData, token_prefix: tapData.token_prefix }, 201);
}

async function getTap(userId: string, tapId: string) {
  const mgmtKey = getMgmtKey();
  const { data, status } = await firehoseRequest(`/v1/taps/${tapId}`, 'GET', mgmtKey);
  if (status !== 200) return err('Tap not found', status);
  return json({ tap: (data as any)?.data || data });
}

async function updateTap(userId: string, tapId: string, body: { name: string }) {
  const mgmtKey = getMgmtKey();
  const { data, status } = await firehoseRequest(`/v1/taps/${tapId}`, 'PUT', mgmtKey, body);
  if (status !== 200) return err('Failed to update tap', status);

  const sb = getServiceClient();
  await sb.from('firehose_taps').update({ tap_name: body.name }).eq('tap_id', tapId).eq('user_id', userId);

  return json({ tap: (data as any)?.data || data });
}

async function revokeTap(userId: string, tapId: string) {
  const mgmtKey = getMgmtKey();
  const { status } = await firehoseRequest(`/v1/taps/${tapId}`, 'DELETE', mgmtKey);
  if (status !== 204) return err('Failed to revoke tap', status);

  const sb = getServiceClient();
  await sb.from('firehose_taps').delete().eq('tap_id', tapId).eq('user_id', userId);

  return json({ success: true });
}

// ── Rule Actions ─────────────────────────────────────────

async function getTapToken(userId: string, localTapId: string): Promise<{ token: string; tapRow: any }> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from('firehose_taps')
    .select('*')
    .eq('id', localTapId)
    .eq('user_id', userId)
    .single();
  if (error || !data?.tap_token_encrypted) throw new Error('Tap not found or no token');
  return { token: data.tap_token_encrypted, tapRow: data };
}

async function listRules(userId: string, localTapId: string) {
  const { token } = await getTapToken(userId, localTapId);
  const { data, status } = await firehoseRequest('/v1/rules', 'GET', token);
  if (status !== 200) return err('Firehose API error', status);

  // Sync local DB
  const sb = getServiceClient();
  const rules = (data as any)?.data || [];
  for (const rule of rules) {
    const existing = await sb.from('firehose_rules')
      .select('id')
      .eq('rule_id', rule.id)
      .eq('tap_id', localTapId)
      .maybeSingle();

    if (!existing.data) {
      await sb.from('firehose_rules').insert({
        tap_id: localTapId,
        user_id: userId,
        rule_id: rule.id,
        rule_value: rule.value,
        tag: rule.tag || null,
      });
    }
  }

  return json({ rules });
}

async function createRule(userId: string, localTapId: string, body: { value: string; tag?: string; nsfw?: boolean; quality?: boolean }) {
  const { token } = await getTapToken(userId, localTapId);
  const { data, status } = await firehoseRequest('/v1/rules', 'POST', token, body);
  if (status !== 201) return err('Failed to create rule', status);

  const ruleData = (data as any)?.data;
  const sb = getServiceClient();
  await sb.from('firehose_rules').insert({
    tap_id: localTapId,
    user_id: userId,
    rule_id: ruleData.id,
    rule_value: ruleData.value,
    tag: ruleData.tag || null,
    nsfw: body.nsfw ?? false,
    quality: body.quality ?? true,
  });

  // Update rules count
  await sb.from('firehose_taps').update({ rules_count: (await sb.from('firehose_rules').select('id', { count: 'exact' }).eq('tap_id', localTapId)).count || 0 }).eq('id', localTapId);

  return json({ rule: ruleData }, 201);
}

async function updateRule(userId: string, localTapId: string, ruleId: string, body: { value?: string; tag?: string; nsfw?: boolean }) {
  const { token } = await getTapToken(userId, localTapId);

  // Get remote rule_id
  const sb = getServiceClient();
  const { data: localRule } = await sb.from('firehose_rules').select('rule_id').eq('id', ruleId).eq('user_id', userId).single();
  if (!localRule) return err('Rule not found', 404);

  const { data, status } = await firehoseRequest(`/v1/rules/${localRule.rule_id}`, 'PUT', token, body);
  if (status !== 200) return err('Failed to update rule', status);

  // Sync local
  const updates: Record<string, unknown> = {};
  if (body.value) updates.rule_value = body.value;
  if (body.tag !== undefined) updates.tag = body.tag;
  if (body.nsfw !== undefined) updates.nsfw = body.nsfw;
  if (Object.keys(updates).length) {
    await sb.from('firehose_rules').update(updates).eq('id', ruleId);
  }

  return json({ rule: (data as any)?.data || data });
}

async function deleteRule(userId: string, localTapId: string, ruleId: string) {
  const { token } = await getTapToken(userId, localTapId);

  const sb = getServiceClient();
  const { data: localRule } = await sb.from('firehose_rules').select('rule_id').eq('id', ruleId).eq('user_id', userId).single();
  if (!localRule) return err('Rule not found', 404);

  const { status } = await firehoseRequest(`/v1/rules/${localRule.rule_id}`, 'DELETE', token);
  if (status !== 204) return err('Failed to delete rule', status);

  await sb.from('firehose_rules').delete().eq('id', ruleId);

  return json({ success: true });
}

// ── Stream / Poll ────────────────────────────────────────

async function pollStream(userId: string, localTapId: string, params: { since?: string; limit?: number }) {
  const { token, tapRow } = await getTapToken(userId, localTapId);

  const qs = new URLSearchParams();
  qs.set('timeout', '30');
  if (params.since) qs.set('since', params.since);
  qs.set('limit', String(params.limit || 100));

  const res = await fetch(`${FIREHOSE_BASE}/v1/stream?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
  });

  if (!res.ok) {
    const text = await res.text();
    return err(`Stream error: ${text}`, res.status);
  }

  // Read the full SSE response and parse events
  const text = await res.text();
  const events: any[] = [];

  const blocks = text.split('\n\n').filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    let eventType = '';
    let eventData = '';
    let eventId = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) eventType = line.slice(7);
      else if (line.startsWith('data: ')) eventData = line.slice(6);
      else if (line.startsWith('id: ')) eventId = line.slice(4);
    }

    if (eventType === 'update' && eventData) {
      try {
        const parsed = JSON.parse(eventData);
        const doc = parsed.document || {};
        const kafkaOffset = eventId ? parseInt(eventId.split('-')[1]) : null;

        events.push({
          query_id: parsed.query_id,
          matched_at: parsed.matched_at,
          url: doc.url,
          title: doc.title,
          language: doc.language,
          page_categories: doc.page_category,
          page_types: doc.page_types,
          diff_chunks: doc.diff?.chunks,
          markdown_excerpt: doc.markdown?.slice(0, 2000),
          kafka_offset: kafkaOffset,
        });
      } catch { /* skip malformed */ }
    }
  }

  // Persist to DB
  if (events.length > 0) {
    const sb = getServiceClient();

    // Map remote rule IDs to local rule IDs
    const { data: localRules } = await sb.from('firehose_rules')
      .select('id, rule_id')
      .eq('tap_id', localTapId);
    const ruleMap = new Map((localRules || []).map(r => [r.rule_id, r.id]));

    const inserts = events.map(e => ({
      tap_id: localTapId,
      user_id: userId,
      rule_id: ruleMap.get(e.query_id) || null,
      matched_at: e.matched_at,
      document_url: e.url,
      document_title: e.title || null,
      document_language: e.language || null,
      page_categories: e.page_categories || null,
      page_types: e.page_types || null,
      diff_chunks: e.diff_chunks || null,
      markdown_excerpt: e.markdown_excerpt || null,
      kafka_offset: e.kafka_offset,
    }));

    const { error: insertErr } = await sb.from('firehose_events').insert(inserts);
    if (insertErr) console.error('[firehose] Events insert error:', insertErr.message);

    // Update last_used_at
    await sb.from('firehose_taps').update({ last_used_at: new Date().toISOString() }).eq('id', localTapId);
  }

  return json({ events_count: events.length, events });
}

// ── Router ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { userId } = await requireAuth(req);

    // Only admin or agency_pro can use Firehose
    const sb = getServiceClient();
    const { data: profile } = await sb.from('profiles').select('plan_type, subscription_status').eq('user_id', userId).single();
    const isAdmin = (await sb.rpc('has_role', { _user_id: userId, _role: 'admin' })).data === true;
    const isPro = profile?.plan_type === 'agency_pro' && ['active', 'canceling'].includes(profile?.subscription_status || '');

    if (!isAdmin && !isPro) {
      return err('Firehose requires Pro Agency plan', 403);
    }

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    const action = body.action || new URL(req.url).searchParams.get('action');

    switch (action) {
      // Tap management
      case 'list_taps':     return await listTaps(userId);
      case 'create_tap':    return await createTap(userId, body);
      case 'get_tap':       return await getTap(userId, body.tap_id);
      case 'update_tap':    return await updateTap(userId, body.tap_id, body);
      case 'revoke_tap':    return await revokeTap(userId, body.tap_id);

      // Rule management
      case 'list_rules':    return await listRules(userId, body.local_tap_id);
      case 'create_rule':   return await createRule(userId, body.local_tap_id, body);
      case 'update_rule':   return await updateRule(userId, body.local_tap_id, body.rule_id, body);
      case 'delete_rule':   return await deleteRule(userId, body.local_tap_id, body.rule_id);

      // Streaming
      case 'poll_stream':   return await pollStream(userId, body.local_tap_id, body);

      default:
        return err(`Unknown action: ${action}`, 400);
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'unauthorized') return err('Authentication required', 401);
    if (msg === 'forbidden') return err('Admin access required', 403);
    console.error('[firehose-actions] Error:', msg);
    return err(msg, 500);
  }
});
