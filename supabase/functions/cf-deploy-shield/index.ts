/**
 * cf-deploy-shield — Sprint 2 GEO
 *
 * Two operating modes:
 *   1. mode = "auto"   → deploy the Worker via Cloudflare API (token required, scope: Workers Scripts:Edit + Zone:Read)
 *   2. mode = "manual" → return the Worker code + ingestion endpoint to paste manually
 *
 * Actions:
 *   - "init"     : ensure cf_shield_configs row + return manual snippet
 *   - "deploy"   : deploy the Worker (auto only) using user-provided cf_token
 *   - "verify"   : ping the route to confirm hits are flowing
 *   - "rotate"   : rotate the ingestion_secret
 *   - "pause"    : status=paused
 *   - "resume"   : status=active
 *
 * Token storage: AES-GCM encrypted with CF_TOKEN_ENCRYPTION_KEY (deferred — until
 * the secret is provided, auto deploy is rejected gracefully).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('CF_TOKEN_ENCRYPTION_KEY'); // optional until user adds it

// ── crypto helpers (AES-GCM 256) ────────────────────────────────────
async function getKey(): Promise<CryptoKey | null> {
  if (!ENCRYPTION_KEY) return null;
  const raw = new TextEncoder().encode(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToken(plain: string): Promise<string> {
  const key = await getKey();
  if (!key) throw new Error('CF_TOKEN_ENCRYPTION_KEY not configured');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  const merged = new Uint8Array(iv.length + ciphertext.byteLength);
  merged.set(iv, 0);
  merged.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...merged));
}

async function decryptToken(encoded: string): Promise<string> {
  const key = await getKey();
  if (!key) throw new Error('CF_TOKEN_ENCRYPTION_KEY not configured');
  const bin = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const iv = bin.slice(0, 12);
  const ciphertext = bin.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

// ── Worker template ──────────────────────────────────────────────────
function buildWorkerScript(ingestUrl: string): string {
  return `// crawlers.fr — Cloudflare Bot Shield Worker (auto-generated)
// Forwards request metadata to crawlers.fr ingest endpoint with zero added latency.
const INGEST = ${JSON.stringify(ingestUrl)};
const SECRET = "__CRAWLERS_SECRET__"; // injected via env binding CRAWLERS_SECRET
const BATCH_SIZE = 20;
const FLUSH_MS = 5000;
let buffer = [];
let flushTimer = null;

async function flush(secret) {
  if (!buffer.length) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    await fetch(INGEST, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Crawlers-Secret": secret },
      body: JSON.stringify(batch),
    });
  } catch (e) { /* never block user request */ }
}

export default {
  async fetch(request, env, ctx) {
    const secret = env.CRAWLERS_SECRET || SECRET;
    const response = await fetch(request);
    try {
      const u = new URL(request.url);
      buffer.push({
        ts: Date.now(),
        ip: request.headers.get("CF-Connecting-IP") || "0.0.0.0",
        ua: request.headers.get("User-Agent") || "",
        method: request.method,
        path: u.pathname + (u.search || ""),
        url: request.url,
        status: response.status,
        referer: request.headers.get("Referer") || null,
        country: request.headers.get("CF-IPCountry") || null,
        cf_ray: request.headers.get("CF-Ray") || null,
      });
      if (buffer.length >= BATCH_SIZE) {
        ctx.waitUntil(flush(secret));
      } else if (!flushTimer) {
        flushTimer = setTimeout(() => { flushTimer = null; ctx.waitUntil(flush(secret)); }, FLUSH_MS);
      }
    } catch (_) { /* swallow */ }
    return response;
  },
};
`;
}

// ── Cloudflare API helpers ───────────────────────────────────────────
async function cfFetch(token: string, path: string, init?: RequestInit) {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.success === false) {
    const msg = json?.errors?.[0]?.message || `CF API ${r.status}`;
    throw new Error(msg);
  }
  return json;
}

async function deployWorker(opts: {
  token: string;
  accountId: string;
  zoneId: string;
  workerName: string;
  routePattern: string;
  ingestUrl: string;
  ingestSecret: string;
}) {
  const script = buildWorkerScript(opts.ingestUrl);
  const metadata = {
    main_module: 'worker.js',
    bindings: [{ type: 'plain_text', name: 'CRAWLERS_SECRET', text: opts.ingestSecret }],
    compatibility_date: new Date().toISOString().split('T')[0],
  };
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  fd.append('worker.js', new Blob([script], { type: 'application/javascript+module' }), 'worker.js');

  // Upload script (module syntax)
  const scriptResp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/workers/scripts/${opts.workerName}`,
    { method: 'PUT', headers: { 'Authorization': `Bearer ${opts.token}` }, body: fd },
  );
  const scriptJson = await scriptResp.json().catch(() => ({}));
  if (!scriptResp.ok || scriptJson.success === false) {
    throw new Error(scriptJson?.errors?.[0]?.message || `Worker upload failed (${scriptResp.status})`);
  }

  // Bind route
  await cfFetch(opts.token, `/zones/${opts.zoneId}/workers/routes`, {
    method: 'POST',
    body: JSON.stringify({ pattern: opts.routePattern, script: opts.workerName }),
  }).catch(async (e) => {
    // If route already exists, that's fine
    if (!String(e.message || '').toLowerCase().includes('already')) throw e;
  });
}

// ── Main handler ─────────────────────────────────────────────────────
Deno.serve(handleRequest(async (req) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError('Unauthorized', 401);

  const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await supabaseAuth.auth.getClaims(authHeader.replace('Bearer ', ''));
  if (claimsErr || !claims?.claims) return jsonError('Unauthorized', 401);
  const userId = claims.claims.sub;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError('Invalid JSON body', 400); }

  const action = String(body.action || 'init');
  const trackedSiteId = body.tracked_site_id as string | undefined;
  if (!trackedSiteId) return jsonError('tracked_site_id required', 400);

  // Verify ownership
  const { data: site } = await supabase
    .from('tracked_sites')
    .select('id, user_id, domain')
    .eq('id', trackedSiteId)
    .maybeSingle();
  if (!site || site.user_id !== userId) return jsonError('Not your site', 403);

  const ingestUrl = `${SUPABASE_URL}/functions/v1/ingest-bot-hits`;

  // ── INIT : ensure config row, return manual snippet ───────────────
  if (action === 'init') {
    const mode = (body.mode as string) === 'auto' ? 'auto' : 'manual';

    // Resolve adaptive sampling rate
    const { data: rateData } = await supabase.rpc('resolve_human_sample_rate', { p_user_id: userId });
    const sampleRate = Number(rateData) || 0.001;

    const { data: existing } = await supabase
      .from('cf_shield_configs')
      .select('id, ingestion_secret, status, deployment_mode')
      .eq('tracked_site_id', trackedSiteId)
      .maybeSingle();

    let configId = existing?.id;
    let ingestionSecret = existing?.ingestion_secret;

    if (!existing) {
      const { data: created, error: insErr } = await supabase
        .from('cf_shield_configs')
        .insert({
          tracked_site_id: trackedSiteId,
          user_id: userId,
          domain: site.domain,
          deployment_mode: mode,
          status: 'pending',
          human_sample_rate: sampleRate,
        })
        .select('id, ingestion_secret')
        .single();
      if (insErr) return jsonError(insErr.message, 500);
      configId = created.id;
      ingestionSecret = created.ingestion_secret;
    } else {
      await supabase
        .from('cf_shield_configs')
        .update({ deployment_mode: mode, human_sample_rate: sampleRate })
        .eq('id', existing.id);
    }

    return jsonOk({
      ok: true,
      config_id: configId,
      mode,
      sample_rate: sampleRate,
      ingest_url: ingestUrl,
      worker_script: buildWorkerScript(ingestUrl).replace('__CRAWLERS_SECRET__', ingestionSecret!),
      manual_instructions: {
        step_1: 'Cloudflare Dashboard → Workers & Pages → Create Worker',
        step_2: 'Paste the worker_script value as the Worker code',
        step_3: `Add environment variable CRAWLERS_SECRET = ${ingestionSecret}`,
        step_4: `Settings → Triggers → Add Route: ${site.domain}/*`,
        step_5: 'Deploy',
      },
    });
  }

  // ── DEPLOY (auto) ─────────────────────────────────────────────────
  if (action === 'deploy') {
    if (!ENCRYPTION_KEY) {
      return jsonError(
        'Le déploiement automatique nécessite la clé CF_TOKEN_ENCRYPTION_KEY. Utilisez le mode manuel en attendant.',
        503,
      );
    }
    const cfToken = body.cf_token as string;
    const accountId = body.cf_account_id as string;
    const zoneId = body.cf_zone_id as string;
    const workerName = (body.cf_worker_name as string) || `crawlers-shield-${site.domain.replace(/[^a-z0-9-]/gi, '-')}`;
    const routePattern = (body.cf_route_pattern as string) || `${site.domain}/*`;

    if (!cfToken || !accountId || !zoneId) {
      return jsonError('cf_token, cf_account_id and cf_zone_id are required', 400);
    }

    // Ensure config row
    const { data: cfg } = await supabase
      .from('cf_shield_configs')
      .select('id, ingestion_secret')
      .eq('tracked_site_id', trackedSiteId)
      .maybeSingle();
    if (!cfg) return jsonError('Run init first', 400);

    try {
      await deployWorker({
        token: cfToken,
        accountId,
        zoneId,
        workerName,
        routePattern,
        ingestUrl,
        ingestSecret: cfg.ingestion_secret,
      });

      const encrypted = await encryptToken(cfToken);
      await supabase
        .from('cf_shield_configs')
        .update({
          cf_token_encrypted: encrypted,
          cf_account_id: accountId,
          cf_zone_id: zoneId,
          cf_worker_name: workerName,
          cf_route_pattern: routePattern,
          deployment_mode: 'auto',
          status: 'active',
          deployed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', cfg.id);

      return jsonOk({ ok: true, status: 'active', worker_name: workerName, route: routePattern });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from('cf_shield_configs')
        .update({ status: 'error', last_error: msg })
        .eq('id', cfg.id);
      return jsonError(`Cloudflare deploy failed: ${msg}`, 502);
    }
  }

  // ── VERIFY : are hits flowing? ────────────────────────────────────
  if (action === 'verify') {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('bot_hits')
      .select('id', { count: 'exact', head: true })
      .eq('tracked_site_id', trackedSiteId)
      .gte('hit_at', since);

    const verified = (count || 0) > 0;
    await supabase
      .from('cf_shield_configs')
      .update({
        last_verified_at: new Date().toISOString(),
        status: verified ? 'active' : 'pending',
      })
      .eq('tracked_site_id', trackedSiteId);

    return jsonOk({ ok: true, verified, hits_last_10min: count || 0 });
  }

  // ── ROTATE secret ────────────────────────────────────────────────
  if (action === 'rotate') {
    const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    const { error: rotErr } = await supabase
      .from('cf_shield_configs')
      .update({ ingestion_secret: newSecret, status: 'pending' })
      .eq('tracked_site_id', trackedSiteId);
    if (rotErr) return jsonError(rotErr.message, 500);
    return jsonOk({ ok: true, ingestion_secret: newSecret, note: 'Update Worker env CRAWLERS_SECRET with this value.' });
  }

  // ── PAUSE / RESUME ───────────────────────────────────────────────
  if (action === 'pause' || action === 'resume') {
    const status = action === 'pause' ? 'paused' : 'active';
    await supabase.from('cf_shield_configs').update({ status }).eq('tracked_site_id', trackedSiteId);
    return jsonOk({ ok: true, status });
  }

  return jsonError(`Unknown action: ${action}`, 400);
}, 'cf-deploy-shield'));
