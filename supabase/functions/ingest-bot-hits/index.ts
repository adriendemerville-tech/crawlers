/**
 * ingest-bot-hits — Sprint 2 GEO
 *
 * Reception endpoint for the Cloudflare Worker shield.
 * Accepts NDJSON or JSON array, authenticates via per-site `ingestion_secret`,
 * applies adaptive human sampling, and inserts into `bot_hits`.
 *
 * Security:
 *   - Public (verify_jwt = false) — auth via X-Crawlers-Secret header
 *   - Each site has its own random ingestion_secret (rotatable)
 *   - IP is SHA-256 hashed before storage (RGPD)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { detectBot } from '../_shared/bot-detection.ts';
import { verifyBot } from '../_shared/bot-verification.ts';

interface RawHit {
  ts?: string | number;
  ip?: string;
  ua?: string;
  user_agent?: string;
  method?: string;
  path?: string;
  url?: string;
  status?: number;
  status_code?: number;
  bytes?: number;
  referer?: string;
  country?: string;
  cf_ray?: string;
  // Cloudflare Worker raw fields
  ClientIP?: string;
  ClientRequestUserAgent?: string;
  ClientRequestURI?: string;
  ClientRequestMethod?: string;
  ClientRequestHost?: string;
  ClientRequestReferer?: string;
  EdgeResponseStatus?: number;
  EdgeStartTimestamp?: number;
  ClientCountry?: string;
}

function normalizeHit(raw: RawHit): {
  ts: Date;
  ip: string;
  ua: string;
  path: string;
  url: string;
  status: number | null;
  referer: string | null;
  country: string | null;
  cf_ray: string | null;
} {
  const ip = raw.ip || raw.ClientIP || '0.0.0.0';
  const ua = raw.user_agent || raw.ua || raw.ClientRequestUserAgent || '';
  const path = raw.path || raw.ClientRequestURI || raw.url || '/';
  const host = raw.ClientRequestHost || '';
  const url = raw.url || (host ? `https://${host}${path}` : path);
  const status = raw.status_code ?? raw.status ?? raw.EdgeResponseStatus ?? null;
  const referer = raw.referer || raw.ClientRequestReferer || null;
  const country = raw.country || raw.ClientCountry || null;
  const cf_ray = raw.cf_ray || null;

  let ts: Date;
  if (typeof raw.ts === 'string') ts = new Date(raw.ts);
  else if (typeof raw.ts === 'number') ts = new Date(raw.ts);
  else if (raw.EdgeStartTimestamp) ts = new Date(raw.EdgeStartTimestamp * 1000);
  else ts = new Date();
  if (isNaN(ts.getTime())) ts = new Date();

  return { ts, ip, ua, path, url, status, referer, country, cf_ray };
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

function botFamilyFromCategory(cat: string | undefined): string | null {
  if (!cat) return null;
  return cat; // search_engine | ai_crawler | seo_tool | social | unknown
}

Deno.serve(handleRequest(async (req) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  const secret = req.headers.get('X-Crawlers-Secret') || req.headers.get('x-crawlers-secret');
  if (!secret) return jsonError('Missing X-Crawlers-Secret', 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Match the secret against cf_shield_configs (constant-time-ish via DB equality).
  const { data: config, error: cfgErr } = await supabase
    .from('cf_shield_configs')
    .select('id, tracked_site_id, user_id, domain, status, human_sample_rate, hits_total')
    .eq('ingestion_secret', secret)
    .maybeSingle();

  if (cfgErr || !config) return jsonError('Invalid secret', 401);
  if (config.status === 'paused') return jsonOk({ ok: true, ignored: 'paused' });

  // Parse body — accept JSON array OR NDJSON
  const bodyText = await req.text();
  if (!bodyText.trim()) return jsonOk({ ok: true, processed: 0 });

  let entries: RawHit[] = [];
  try {
    const trimmed = bodyText.trim();
    if (trimmed.startsWith('[')) {
      entries = JSON.parse(trimmed);
    } else if (trimmed.startsWith('{')) {
      // Single object OR NDJSON
      if (trimmed.includes('\n')) {
        entries = trimmed.split('\n').filter(Boolean).map(l => JSON.parse(l));
      } else {
        entries = [JSON.parse(trimmed)];
      }
    } else {
      return jsonError('Invalid body format', 400);
    }
  } catch (e) {
    return jsonError(`Body parse error: ${e instanceof Error ? e.message : String(e)}`, 400);
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return jsonOk({ ok: true, processed: 0 });
  }

  // Cap batch size to protect DB
  const MAX_BATCH = 500;
  const trimmed = entries.slice(0, MAX_BATCH);

  const sampleRate = Number(config.human_sample_rate) || 0.001;

  const rows = await Promise.all(trimmed.map(async (raw) => {
    const n = normalizeHit(raw);
    // Vérification rapide IP-range only (le rDNS est trop lent ici, repassé par cron arrière-plan)
    const verification = await verifyBot(n.ip, n.ua, { enableRdns: false });
    const detection = detectBot(n.ua);
    const isAiBot = (verification.is_bot && verification.bot_category === 'ai_crawler')
      || (detection.is_bot && detection.bot_category === 'ai_crawler');
    const isHuman = !verification.is_bot && !detection.is_bot;

    // Adaptive sampling for humans (we keep ALL bot hits, only sample humans)
    const isHumanSample = isHuman && Math.random() < sampleRate;
    if (isHuman && !isHumanSample) return null;

    const ipHash = n.ip && n.ip !== '0.0.0.0' ? await sha256Hex(n.ip) : null;

    return {
      tracked_site_id: config.tracked_site_id,
      user_id: config.user_id,
      domain: config.domain,
      hit_at: n.ts.toISOString(),
      url: n.url.slice(0, 2000),
      path: n.path.slice(0, 1000),
      user_agent: n.ua.slice(0, 500),
      bot_family: botFamilyFromCategory(verification.bot_category || detection.bot_category),
      bot_name: verification.bot_name || detection.bot_name || null,
      is_ai_bot: isAiBot,
      is_human_sample: isHumanSample,
      status_code: n.status,
      country: n.country,
      ip_hash: ipHash,
      referer: n.referer ? n.referer.slice(0, 1000) : null,
      cf_ray: n.cf_ray,
      verification_status: verification.status,
      verification_method: verification.method,
      confidence_score: verification.confidence,
      raw_meta: {},
    };
  }));

  const validRows = rows.filter(Boolean);
  if (validRows.length === 0) {
    return jsonOk({ ok: true, processed: 0, dropped_humans: trimmed.length });
  }

  const { error: insErr } = await supabase.from('bot_hits').insert(validRows);
  if (insErr) {
    console.error('[ingest-bot-hits] insert error', insErr);
    return jsonError(insErr.message, 500);
  }

  // Best-effort stats update (non-blocking)
  supabase
    .from('cf_shield_configs')
    .update({
      hits_total: (config.hits_total || 0) + validRows.length,
      last_hit_at: new Date().toISOString(),
      status: config.status === 'pending' ? 'active' : config.status,
    })
    .eq('id', config.id)
    .then(() => {})
    .catch(() => {});

  return jsonOk({
    ok: true,
    processed: validRows.length,
    received: entries.length,
    sample_rate: sampleRate,
  });
}, 'ingest-bot-hits'));
