/**
 * ingest-senthor — passerelle d'ingestion Senthor → bot_hits
 *
 * Reçoit les événements de détection Senthor (webhook sortant ou relais pull)
 * pour les sites qui ne sont pas derrière Cloudflare.
 *
 * Authentification (au choix) :
 *   - Header `X-Crawlers-Secret: <ingestion_secret>` (identique à ingest-bot-hits)
 *   - Header `X-Senthor-Signature: sha256=<hex>` + `X-Crawlers-Domain: <domain>`
 *     HMAC-SHA256 du corps brut, clé = ingestion_secret du site.
 *
 * Corps accepté : tableau JSON, NDJSON, objet unique, ou `{ events: [...] }`.
 *
 * Sécurité : public (verify_jwt = false), l'IP n'est jamais stockée en clair
 * (SHA-256), les humains sont échantillonnés selon human_sample_rate.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { detectBot } from '../_shared/bot-detection.ts';

interface SenthorEvent {
  id?: string;
  domain?: string;
  ts?: string | number;
  timestamp?: string | number;
  method?: string;
  path?: string;
  url?: string;
  status?: number;
  status_code?: number;
  user_agent?: string;
  ua?: string;
  ip?: string;
  ip_hash?: string;
  country?: string;
  referer?: string;
  referrer?: string;
  is_bot?: boolean;
  bot_name?: string;
  bot_category?: string;
  verification_status?: string;
  verification_method?: string;
  confidence?: number;
  decision?: string;
}

const MAX_BATCH = 500;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseBody(text: string): SenthorEvent[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  if (trimmed.startsWith('{')) {
    if (trimmed.includes('\n')) {
      return trimmed.split('\n').filter(Boolean).map(l => JSON.parse(l));
    }
    const obj = JSON.parse(trimmed);
    if (Array.isArray(obj?.events)) return obj.events;
    if (Array.isArray(obj?.data)) return obj.data;
    return [obj];
  }
  throw new Error('Unsupported body format');
}

function toDate(v: unknown): Date {
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof v === 'number') {
    const d = new Date(v < 1e12 ? v * 1000 : v);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

Deno.serve(handleRequest(async (req) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const bodyText = await req.text();
  const secretHeader = req.headers.get('x-crawlers-secret');
  const signature = (req.headers.get('x-senthor-signature') || req.headers.get('x-crawlers-signature') || '')
    .replace(/^sha256=/, '');
  const domainHeader = (req.headers.get('x-crawlers-domain') || '').toLowerCase().replace(/^www\./, '');

  const selectCols = 'id, tracked_site_id, user_id, domain, status, human_sample_rate, hits_total, ingestion_secret';

  let config: Record<string, unknown> | null = null;

  if (secretHeader) {
    const { data } = await supabase
      .from('cf_shield_configs')
      .select(selectCols)
      .eq('ingestion_secret', secretHeader)
      .maybeSingle();
    config = data;
  } else if (signature && domainHeader) {
    const { data } = await supabase
      .from('cf_shield_configs')
      .select(selectCols)
      .eq('domain', domainHeader)
      .maybeSingle();
    if (data?.ingestion_secret) {
      const expected = await hmacHex(data.ingestion_secret as string, bodyText);
      if (timingSafeEqual(expected, signature.toLowerCase())) config = data;
    }
  } else {
    return jsonError('Missing X-Crawlers-Secret or X-Senthor-Signature + X-Crawlers-Domain', 401);
  }

  if (!config) return jsonError('Invalid credentials', 401);
  if (config.status === 'paused') return jsonOk({ ok: true, ignored: 'paused' });

  let events: SenthorEvent[];
  try {
    events = parseBody(bodyText);
  } catch (e) {
    return jsonError(`Body parse error: ${e instanceof Error ? e.message : String(e)}`, 400);
  }
  if (!Array.isArray(events) || events.length === 0) return jsonOk({ ok: true, processed: 0 });

  const batch = events.slice(0, MAX_BATCH);
  const sampleRate = Number(config.human_sample_rate) || 0.001;

  const rows = await Promise.all(batch.map(async (e) => {
    const ua = e.user_agent || e.ua || '';
    const detection = detectBot(ua);

    // Senthor est la source de vérité quand elle qualifie l'événement,
    // notre détection UA sert de repli.
    const isBot = typeof e.is_bot === 'boolean' ? e.is_bot : detection.is_bot;
    const category = e.bot_category || detection.bot_category || null;
    const isAiBot = isBot && category === 'ai_crawler';
    const isHuman = !isBot;

    const isHumanSample = isHuman && Math.random() < sampleRate;
    if (isHuman && !isHumanSample) return null;

    const path = e.path || (e.url ? (() => { try { return new URL(e.url!).pathname; } catch { return e.url!; } })() : '/');
    const url = e.url || `https://${config!.domain}${path}`;

    let ipHash: string | null = null;
    if (e.ip_hash) ipHash = String(e.ip_hash).replace(/^sha256:/, '');
    else if (e.ip && e.ip !== '0.0.0.0') ipHash = await sha256Hex(e.ip);

    return {
      tracked_site_id: config!.tracked_site_id,
      user_id: config!.user_id,
      domain: config!.domain,
      hit_at: toDate(e.ts ?? e.timestamp).toISOString(),
      url: String(url).slice(0, 2000),
      path: String(path).slice(0, 1000),
      user_agent: ua.slice(0, 500),
      bot_family: category,
      bot_name: e.bot_name || detection.bot_name || null,
      is_ai_bot: isAiBot,
      is_human_sample: isHumanSample,
      status_code: e.status_code ?? e.status ?? null,
      country: e.country || null,
      ip_hash: ipHash,
      referer: (e.referer || e.referrer) ? String(e.referer || e.referrer).slice(0, 1000) : null,
      cf_ray: null,
      verification_status: e.verification_status || (isBot ? 'unverified' : 'human'),
      verification_method: e.verification_method || (e.is_bot !== undefined ? 'senthor' : 'ua_pattern'),
      confidence_score: typeof e.confidence === 'number' ? e.confidence : null,
      raw_meta: { source: 'senthor', senthor_id: e.id ?? null, decision: e.decision ?? null },
    };
  }));

  const validRows = rows.filter(Boolean);
  if (validRows.length === 0) {
    return jsonOk({ ok: true, processed: 0, dropped_humans: batch.length });
  }

  const { error: insErr } = await supabase.from('bot_hits').insert(validRows);
  if (insErr) {
    console.error('[ingest-senthor] insert error', insErr);
    return jsonError(insErr.message, 500);
  }

  supabase
    .from('cf_shield_configs')
    .update({
      hits_total: (Number(config.hits_total) || 0) + validRows.length,
      last_hit_at: new Date().toISOString(),
      status: config.status === 'pending' ? 'active' : config.status,
    })
    .eq('id', config.id)
    .then(() => {})
    .catch(() => {});

  return jsonOk({
    ok: true,
    processed: validRows.length,
    received: events.length,
    sample_rate: sampleRate,
  });
}, 'ingest-senthor'));
