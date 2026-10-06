/**
 * MCP Server for Crawlers.fr — mcp-lite with raw JSON Schema (no zod needed)
 */
import { Hono } from "hono";
import { McpServer, StreamableHttpTransport, RpcError } from "mcp-lite";
import { AsyncLocalStorage } from "node:async_hooks";
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { MARINA_MCP_REPORT_COST, checkMarinaEntitlement, chargeMarinaReport, refundMarinaReport } from "../_shared/marinaBilling.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const FREE_TOOLS = new Set(['check_geo_score', 'check_llm_visibility', 'check_ai_crawlers']);
const TOOL_TO_FUNCTION: Record<string, string> = {
  check_geo_score: 'check-geo', check_llm_visibility: 'check-llm-depth', check_ai_crawlers: 'check-crawlers',
  expert_seo_audit: 'audit-expert-seo', strategic_ai_audit: 'audit-strategique-ia',
  generate_corrective_code: 'generate-corrective-code', dry_run_script: 'dry-run-script',
  calculate_cocoon_logic: 'calculate-cocoon-logic', measure_audit_impact: 'auto-measure-predictions',
  wordpress_sync: 'wpsync', fetch_serp_kpis: 'fetch-serp-kpis', calculate_ias: 'calculate-ias',
};

// Adapte les arguments MCP au contrat d'entrée réel de chaque edge function.
function bareDomain(v: string): string {
  return v.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
}

function toUrl(a: Record<string, unknown>): Record<string, unknown> {
  const raw = String(a['url'] ?? a['domain'] ?? '').trim();
  if (!raw) return a;
  return { ...a, url: /^https?:\/\//i.test(raw) ? raw : `https://${raw}` };
}

const ARG_ADAPT: Record<string, (a: Record<string, unknown>) => Record<string, unknown>> = {
  // check-geo et check-crawlers exigent une `url` absolue ; le schéma MCP expose `domain`.
  check_geo_score: toUrl,
  check_ai_crawlers: toUrl,
  expert_seo_audit: toUrl,
  strategic_ai_audit: toUrl,
  generate_corrective_code: toUrl,
  // check-llm-depth exige un domaine nu, sans protocole ni chemin.
  check_llm_visibility: (a) => ({ ...a, domain: bareDomain(String(a['domain'] ?? a['url'] ?? '')) }),
};

/**
 * Résolveurs asynchrones : traduisent les arguments MCP en contrat réel de la
 * fonction cible quand une lecture base est nécessaire.
 *
 * `dry_run_script` : le schéma MCP expose `script_id` + `target_url`, alors que
 * `dry-run-script` attend `{ siteUrl, code }`. On résout le code depuis
 * `site_script_rules` en vérifiant la propriété de la règle (isolation multi-tenant).
 */
type Resolved = { payload: Record<string, unknown> } | { error: string };

const ARG_RESOLVE: Record<string, (a: Record<string, unknown>, auth: Auth | null) => Promise<Resolved>> = {
  dry_run_script: async (a, auth) => {
    const scriptId = String(a['script_id'] ?? '').trim();
    const rawUrl = String(a['target_url'] ?? a['url'] ?? '').trim();
    if (!scriptId) return { error: 'script_id est requis.' };
    if (!auth) return { error: 'Authentification requise.' };
    if (!/^[0-9a-f-]{36}$/i.test(scriptId)) return { error: 'script_id doit être un identifiant de règle (UUID).' };

    const sb = getServiceClient();
    let q = sb
      .from('site_script_rules')
      .select('id, user_id, script_source, payload_data, url_pattern, domain_id')
      .eq('id', scriptId);
    if (!auth.isAdmin) q = q.eq('user_id', auth.userId);
    const { data: rule, error } = await q.maybeSingle();
    if (error) return { error: `Lecture de la règle impossible : ${error.message}` };
    if (!rule) return { error: 'Script introuvable ou non accessible avec ce compte.' };

    const pd = (rule as any).payload_data as Record<string, unknown> | null;
    const code = String(
      (rule as any).script_source ?? pd?.['code'] ?? pd?.['script'] ?? pd?.['script_source'] ?? '',
    ).trim();
    if (!code) return { error: 'Cette règle ne contient aucun code généré (génération en attente).' };

    // URL de test : celle fournie, sinon le domaine de la règle.
    let siteUrl = rawUrl;
    if (!siteUrl) {
      const { data: site } = await sb
        .from('tracked_sites')
        .select('domain')
        .eq('id', (rule as any).domain_id)
        .maybeSingle();
      const dom = (site as any)?.domain;
      if (!dom) return { error: 'target_url est requis (domaine de la règle introuvable).' };
      siteUrl = `https://${bareDomain(String(dom))}`;
    }
    if (!/^https?:\/\//i.test(siteUrl)) siteUrl = `https://${siteUrl}`;

    return { payload: { siteUrl, code } };
  },
};

async function checkKillSwitch(): Promise<boolean> {
  try { const { data } = await getServiceClient().from('system_config').select('value').eq('key', 'mcp_enabled').maybeSingle(); return !data || data.value !== false; } catch { return true; }
}

// ── Contexte par requête : aucun état d'auth partagé entre requêtes concurrentes ──
interface ReqCtx { authorization: string | null; marinaKey: string | null; }
const reqStore = new AsyncLocalStorage<ReqCtx>();
const reqCtx = (): ReqCtx => reqStore.getStore() ?? { authorization: null, marinaKey: null };

/** Appelant résolu : clé Marina ou JWT. */
interface Caller { userId: string; isAdmin: boolean; isProAgency: boolean; via: 'key' | 'jwt'; key?: string; jwt?: string; }
type Auth = Caller;

const isMarinaKey = (t: string) => t.startsWith('marina_') || t.startsWith('mk_live_');

/** Même règle que `isAgencyPro` de src/contexts/CreditsContext.tsx (inclut agency_premium). */
function proAgencyRule(p: any): boolean {
  return ['agency_pro', 'agency_premium'].includes(p?.plan_type)
    && (p?.subscription_status === 'active' || p?.subscription_status === 'canceling')
    && (!p?.subscription_expires_at || new Date(p.subscription_expires_at) > new Date());
}

async function loadEntitlements(userId: string) {
  const sb = getServiceClient();
  const [pr, ar] = await Promise.all([
    sb.from('profiles').select('plan_type, subscription_status, subscription_expires_at, credits_balance').eq('user_id', userId).maybeSingle(),
    sb.rpc('has_role', { _user_id: userId, _role: 'admin' }),
  ]);
  return { isAdmin: ar.data === true, isProAgency: proAgencyRule(pr.data) };
}

/** Bearer porteur d'une clé Marina → jamais à transmettre en aval. */
function bearerToken(ah: string | null): string | null {
  return ah?.startsWith('Bearer ') ? ah.slice(7).trim() : null;
}

/**
 * Résout l'appelant. `null` = pas d'auth exploitable ; `'invalid_key'` = clé fournie mais refusée.
 */
async function resolveCaller(): Promise<Caller | null | 'invalid_key'> {
  const { authorization, marinaKey } = reqCtx();
  const bearer = bearerToken(authorization);
  const key = marinaKey?.trim() || (bearer && isMarinaKey(bearer) ? bearer : null);
  if (key) {
    const { data: row } = await getServiceClient().from('marina_api_keys').select('user_id, is_active').eq('api_key', key).maybeSingle();
    if (!row || (row as any).is_active === false) return 'invalid_key';
    const userId = String((row as any).user_id);
    return { userId, ...(await loadEntitlements(userId)), via: 'key', key };
  }
  if (!bearer) return null;
  const { data: { user }, error } = await getUserClient(authorization!).auth.getUser();
  if (error || !user) return null;
  return { userId: user.id, ...(await loadEntitlements(user.id)), via: 'jwt', jwt: authorization! };
}

async function safeCaller(): Promise<Caller | null> {
  try { const c = await resolveCaller(); return c && c !== 'invalid_key' ? c : null; } catch { return null; }
}

/** Authorization à transmettre en aval : jamais une clé Marina. */
function forwardableAuth(): string | undefined {
  const { authorization } = reqCtx();
  const b = bearerToken(authorization);
  if (!authorization || (b && isMarinaKey(b))) return undefined;
  return authorization;
}

async function rateOk(uid: string, tool: string): Promise<boolean> {
  try { const { data } = await getServiceClient().rpc('check_rate_limit', { p_user_id: uid, p_action: `mcp:${tool}`, p_max_count: 30, p_window_minutes: 60 }); return data?.allowed !== false; } catch { return true; }
}

async function log(uid: string | null, tool: string, params: unknown, status: string, err: string | null, ms: number) {
  try { await getServiceClient().from('mcp_usage_logs').insert({ user_id: uid, tool_name: tool, input_params: params, status, error_message: err, execution_time_ms: ms }); } catch {}
}

async function callFn(fn: string, body: unknown, auth?: string, extra: Record<string, string> = {}) {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': auth || `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`, ...extra };
  try { const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(body) }); const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; } if (!r.ok) return { data: null, error: `${r.status}: ${t.slice(0, 500)}` }; return { data: d, error: null }; } catch (e) { return { data: null, error: (e as Error).message }; }
}

const AUTH_HEADERS_HINT = "Envoyez votre clé Marina dans l'en-tête `x-marina-key: <clé>` ou `Authorization: Bearer <clé>` (Console → API → Marina), ou un jeton de session `Authorization: Bearer <JWT>`.";
const SESSION_REQUIRED_MSG = 'Cet outil nécessite un jeton de session : Authorization: Bearer <JWT>';

/**
 * Outils Pro dont la fonction cible identifie l'utilisateur par son JWT
 * (getUser) ou traite tous les sites : inaccessibles avec une clé Marina.
 */
const KEY_NEEDS_SESSION = new Set(['calculate_cocoon_logic', 'wordpress_sync', 'measure_audit_impact']);
/** Outils Pro qui attendent `user_id` dans le payload : injecté depuis la clé après contrôle de propriété du site. */
const KEY_INJECT_USER = new Set(['fetch_serp_kpis', 'calculate_ias']);

async function ownsSite(userId: string, siteId: string): Promise<boolean> {
  const { data } = await getServiceClient().from('tracked_sites').select('id').eq('id', siteId).eq('user_id', userId).maybeSingle();
  return !!data;
}

function handler(tool: string) {
  return async (args: Record<string, unknown>) => {
    const t0 = Date.now(); const isFree = FREE_TOOLS.has(tool);
    if (!(await checkKillSwitch())) { await log(null, tool, args, 'blocked', 'disabled', Date.now() - t0); return { content: [{ type: 'text' as const, text: 'MCP Crawlers temporairement désactivé.' }] }; }
    let auth: Auth | null = null;
    if (!isFree) {
      auth = await safeCaller();
      if (!auth) { await log(null, tool, args, 'unauthorized', 'no token', Date.now() - t0); return { content: [{ type: 'text' as const, text: `Accès Pro Agency requis. ${AUTH_HEADERS_HINT} https://crawlers.fr/tarifs` }] }; }
      if (!auth.isAdmin && !auth.isProAgency) { await log(auth.userId, tool, args, 'forbidden', 'not pro', Date.now() - t0); return { content: [{ type: 'text' as const, text: 'Réservé Pro Agency. https://crawlers.fr/tarifs' }] }; }
      if (auth.via === 'key' && KEY_NEEDS_SESSION.has(tool)) { await log(auth.userId, tool, args, 'forbidden', 'session required', Date.now() - t0); throw new RpcError(-32001, SESSION_REQUIRED_MSG); }
      if (!(await rateOk(auth.userId, tool))) { await log(auth.userId, tool, args, 'rate_limited', '30/h', Date.now() - t0); return { content: [{ type: 'text' as const, text: 'Limite de 30 appels par heure atteinte.' }] }; }
    } else { auth = await safeCaller(); }
    let payload: Record<string, unknown>;
    if (ARG_RESOLVE[tool]) {
      const r = await ARG_RESOLVE[tool]!(args, auth);
      if ('error' in r) { await log(auth?.userId || null, tool, args, 'error', r.error, Date.now() - t0); return { content: [{ type: 'text' as const, text: `Erreur: ${r.error}` }] }; }
      payload = r.payload;
    } else {
      payload = ARG_ADAPT[tool] ? ARG_ADAPT[tool]!(args) : args;
    }
    // Appel par clé : jamais d'identité arbitraire venant du client.
    if (auth?.via === 'key' && !isFree) {
      const { user_id: _drop, ...rest } = payload;
      payload = rest;
      if (KEY_INJECT_USER.has(tool)) {
        const siteId = String(payload['tracked_site_id'] ?? '').trim();
        if (siteId && !(await ownsSite(auth.userId, siteId)) && !auth.isAdmin) throw new RpcError(-32602, 'tracked_site_id introuvable pour ce compte.');
        if (tool === 'calculate_ias' && !siteId) throw new RpcError(-32602, 'tracked_site_id est requis.');
        payload = { ...payload, user_id: auth.userId };
      }
    }
    const res = await callFn(TOOL_TO_FUNCTION[tool], payload, forwardableAuth()); const ms = Date.now() - t0;
    if (res.error) { await log(auth?.userId || null, tool, args, 'error', res.error, ms); return { content: [{ type: 'text' as const, text: `Erreur: ${res.error}` }] }; }
    await log(auth?.userId || null, tool, args, 'success', null, ms);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] };
  };
}

// ── Outils Marina (clé Marina ou JWT, facturation serveur) ─────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const textJson = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] });
const marinaAuthMsg = (tool: string) => `Authentification requise pour ${tool}. Envoyez votre clé Marina dans l'en-tête \`x-marina-key: <clé>\` ou \`Authorization: Bearer <clé>\` (Console → API → Marina). Coût : 5 crédits par rapport, ou inclus avec un abonnement Pro Agency actif.`;

async function requireMarinaCaller(tool: string, args: unknown, t0: number): Promise<Caller> {
  if (!(await checkKillSwitch())) throw new RpcError(-32001, 'MCP Crawlers temporairement désactivé.');
  let c: Caller | null | 'invalid_key' = null;
  try { c = await resolveCaller(); } catch { c = null; }
  if (c === 'invalid_key') { await log(null, tool, args, 'unauthorized', 'invalid key', Date.now() - t0); throw new RpcError(-32001, `Clé Marina invalide ou désactivée. ${marinaAuthMsg(tool)}`); }
  if (!c) { await log(null, tool, args, 'unauthorized', 'no auth', Date.now() - t0); throw new RpcError(-32001, marinaAuthMsg(tool)); }
  return c;
}

function normalizeHttpUrl(raw: unknown, field: string, prefix: boolean): string {
  let s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) throw new RpcError(-32602, `${field} est requis.`);
  if (prefix && !/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { throw new RpcError(-32602, `${field} invalide.`); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new RpcError(-32602, `${field} doit être en http ou https.`);
  if (!u.hostname.includes('.')) throw new RpcError(-32602, `${field} invalide.`);
  return u.toString();
}

/** Headers pour appeler marina au nom de l'appelant (clé → x-marina-key, JWT → Authorization). */
function marinaHeaders(c: Caller): { auth?: string; extra: Record<string, string> } {
  return c.via === 'key' ? { extra: { 'x-marina-key': c.key! } } : { auth: c.jwt, extra: {} };
}

async function loadOwnedJob(c: Caller, jobId: unknown) {
  const id = typeof jobId === 'string' ? jobId.trim() : '';
  if (!UUID_RE.test(id)) throw new RpcError(-32602, 'job_id doit être un UUID.');
  const { data } = await getServiceClient().from('async_jobs').select('id, user_id, status, result_data').eq('id', id).eq('function_name', 'marina').maybeSingle();
  if (!data || (!c.isAdmin && (data as any).user_id !== c.userId)) throw new RpcError(-32003, 'Job introuvable pour ce compte');
  return data as any;
}

async function marinaCreateReport(args: Record<string, unknown>) {
  const tool = 'marina_create_report'; const t0 = Date.now();
  const c = await requireMarinaCaller(tool, args, t0);
  const url = normalizeHttpUrl(args['url'], 'url', true);
  const lang = args['lang'];
  if (lang !== undefined && !['fr', 'en', 'es'].includes(String(lang))) throw new RpcError(-32602, 'lang doit valoir fr, en ou es.');
  const callback_url = args['callback_url'] !== undefined ? normalizeHttpUrl(args['callback_url'], 'callback_url', false) : undefined;
  if (!(await rateOk(c.userId, tool))) { await log(c.userId, tool, args, 'rate_limited', '30/h', Date.now() - t0); throw new RpcError(-32002, 'Limite de 30 appels par heure atteinte.'); }

  const mode = checkMarinaEntitlement(c);
  let charged = 0; let balanceAfter: number | undefined;
  if (mode === 'credits') {
    const ch = await chargeMarinaReport(c.userId, url);
    if (!ch.success) {
      await log(c.userId, tool, args, 'payment_required', ch.error, Date.now() - t0);
      throw new RpcError(-32002, `Crédits insuffisants : ${MARINA_MCP_REPORT_COST} crédits requis, solde ${ch.balance}. Rechargez sur https://crawlers.fr/tarifs ou souscrivez Pro Agency.`, { required_credits: MARINA_MCP_REPORT_COST, balance: ch.balance });
    }
    charged = MARINA_MCP_REPORT_COST; balanceAfter = ch.balance;
  }

  const h = marinaHeaders(c);
  const res = await callFn('marina', { url, ...(lang ? { lang } : {}), ...(callback_url ? { callback_url } : {}) }, h.auth, h.extra);
  const jobId = (res.data as any)?.job_id;
  if (res.error || !jobId) {
    if (charged) await refundMarinaReport(c.userId, charged);
    const msg = res.error || 'Marina n\'a pas renvoyé de job_id';
    await log(c.userId, tool, args, 'error', msg, Date.now() - t0);
    throw new RpcError(-32603, `Création du rapport impossible${charged ? ' (crédits remboursés)' : ''} : ${msg}`);
  }
  await log(c.userId, tool, args, 'success', null, Date.now() - t0);
  const d = res.data as any;
  return textJson({
    job_id: jobId,
    status: d.status === 'queued' ? 'queued' : 'pending',
    ...(d.queue_position ? { queue_position: d.queue_position } : {}),
    billing: { mode, credits_charged: charged, ...(balanceAfter !== undefined ? { balance_after: balanceAfter } : {}) },
    poll_with: 'marina_get_report',
  });
}

async function marinaGetReport(args: Record<string, unknown>) {
  const tool = 'marina_get_report'; const t0 = Date.now();
  const c = await requireMarinaCaller(tool, args, t0);
  const job = await loadOwnedJob(c, args['job_id']);
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/marina?job_id=${job.id}`, { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` } });
    const body = await r.json().catch(() => ({}));
    await log(c.userId, tool, args, 'success', null, Date.now() - t0);
    return textJson({ job_id: job.id, ...body });
  } catch (e) {
    await log(c.userId, tool, args, 'error', (e as Error).message, Date.now() - t0);
    throw new RpcError(-32603, `Lecture du job impossible : ${(e as Error).message}`);
  }
}

async function marinaListJobs(args: Record<string, unknown>) {
  const tool = 'marina_list_jobs'; const t0 = Date.now();
  const c = await requireMarinaCaller(tool, args, t0);
  const limit = args['limit'] === undefined ? 20 : Number(args['limit']);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RpcError(-32602, 'limit doit être un entier entre 1 et 50.');
  const status = args['status'];
  const STATUSES = ['pending', 'processing', 'completed', 'partial', 'failed'];
  if (status !== undefined && !STATUSES.includes(String(status))) throw new RpcError(-32602, `status doit valoir ${STATUSES.join(', ')}.`);
  let q = getServiceClient().from('async_jobs')
    .select('id, status, progress, created_at, completed_at, url:input_payload->>url, lang:input_payload->>lang, report_view_url:result_data->>report_view_url')
    .eq('user_id', c.userId).eq('function_name', 'marina').order('created_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', String(status));
  const { data, error } = await q;
  if (error) throw new RpcError(-32603, `Lecture des jobs impossible : ${error.message}`);
  await log(c.userId, tool, args, 'success', null, Date.now() - t0);
  return textJson({ jobs: (data ?? []).map((j: any) => ({ job_id: j.id, status: j.status, progress: j.progress, url: j.url, lang: j.lang, created_at: j.created_at, completed_at: j.completed_at, report_view_url: j.report_view_url ?? null })) });
}

/** PDF via le même Browserless que src/routes/api/render-report-pdf.ts. Aucun débit. */
async function marinaExportPdf(args: Record<string, unknown>) {
  const tool = 'marina_export_pdf'; const t0 = Date.now();
  const c = await requireMarinaCaller(tool, args, t0);
  const job = await loadOwnedJob(c, args['job_id']);
  if (job.status !== 'completed' && job.status !== 'partial') throw new RpcError(-32602, 'Le rapport n\'est pas encore terminé.');
  const path = String(job.result_data?.report_path ?? '');
  if (!path) throw new RpcError(-32603, 'Fichier du rapport introuvable.');
  const token = Deno.env.get('RENDERING_API_KEY') || Deno.env.get('BROWSERLESS_API_KEY');
  if (!token) throw new RpcError(-32603, 'Rendu PDF indisponible.');
  const sb = getServiceClient();
  const pdfPath = path.replace(/\.html?$/i, '') + '.pdf';
  const { data: existing } = await sb.storage.from('shared-reports').createSignedUrl(pdfPath, 7 * 24 * 3600);
  if (!existing?.signedUrl) {
    const { data: file, error: dlErr } = await sb.storage.from('shared-reports').download(path);
    if (dlErr || !file) throw new RpcError(-32603, 'Lecture du rapport impossible.');
    const html = (await file.text()).replace('</head>', '<style>@page{size:A4;margin:14mm 10mm}.marina-toolbar{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head>');
    const r = await fetch(`https://production-sfo.browserless.io/pdf?token=${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, options: { format: 'A4', printBackground: true, preferCSSPageSize: true }, gotoOptions: { waitUntil: 'networkidle0', timeout: 60000 } }),
    });
    if (!r.ok) { await log(c.userId, tool, args, 'error', `render ${r.status}`, Date.now() - t0); throw new RpcError(-32603, `Rendu PDF échoué (${r.status}).`); }
    const pdf = new Uint8Array(await r.arrayBuffer());
    const { error: upErr } = await sb.storage.from('shared-reports').upload(pdfPath, new Blob([pdf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new RpcError(-32603, `Enregistrement du PDF impossible : ${upErr.message}`);
  }
  const { data: signed } = await sb.storage.from('shared-reports').createSignedUrl(pdfPath, 7 * 24 * 3600);
  if (!signed?.signedUrl) throw new RpcError(-32603, 'Signature du PDF impossible.');
  await log(c.userId, tool, args, 'success', null, Date.now() - t0);
  return textJson({ job_id: job.id, pdf_url: signed.signedUrl });
}

// ── MCP Server (no schemaAdapter = raw JSON Schema) ─────

const SERVER_VERSION = '1.1.0';
const mcp = new McpServer({ name: "crawlers-fr", version: SERVER_VERSION });
let TOOL_COUNT = 0;
const reg = (name: string, def: any) => { TOOL_COUNT++; mcp.tool(name, def); };

const domainSchema = { type: "object" as const, properties: { domain: { type: "string" as const, description: "Domain e.g. example.com" } }, required: ["domain" as const] };
const urlSchema = { type: "object" as const, properties: { url: { type: "string" as const, description: "Full URL" } }, required: ["url" as const] };

reg("check_geo_score", { description: "GEO score (0-100) for AI engine optimization.", inputSchema: domainSchema, handler: handler('check_geo_score') });
reg("check_llm_visibility", { description: "Domain visibility across LLMs (ChatGPT, Gemini, Perplexity, Claude).", inputSchema: domainSchema, handler: handler('check_llm_visibility') });
reg("check_ai_crawlers", { description: "AI bot analysis (GPTBot, ClaudeBot, Google-Extended).", inputSchema: domainSchema, handler: handler('check_ai_crawlers') });
reg("expert_seo_audit", { description: "200-point SEO audit. Pro Agency required.", inputSchema: urlSchema, handler: handler('expert_seo_audit') });
reg("strategic_ai_audit", { description: "Strategic AI audit: SEO+GEO+competitive. Pro Agency required.", inputSchema: { type: "object" as const, properties: { url: { type: "string" as const }, sector: { type: "string" as const } }, required: ["url" as const] }, handler: handler('strategic_ai_audit') });
reg("generate_corrective_code", { description: "Generate JS corrective code for SEO/GEO fixes. Pro Agency required.", inputSchema: { type: "object" as const, properties: { url: { type: "string" as const }, audit_id: { type: "string" as const } }, required: ["url" as const] }, handler: handler('generate_corrective_code') });
reg("dry_run_script", { description: "Sandbox test of a generated corrective script (site_script_rules id) on the live page: JS errors, CLS, JSON-LD validity. Pro Agency required.", inputSchema: { type: "object" as const, properties: { script_id: { type: "string" as const, description: "site_script_rules UUID" }, target_url: { type: "string" as const, description: "Optional test URL; defaults to the rule domain" } }, required: ["script_id" as const] }, handler: handler('dry_run_script') });
reg("calculate_cocoon_logic", { description: "Semantic cocoon via TF-IDF. Pro Agency required.", inputSchema: { type: "object" as const, properties: { domain: { type: "string" as const }, tracked_site_id: { type: "string" as const } }, required: ["domain" as const, "tracked_site_id" as const] }, handler: handler('calculate_cocoon_logic') });
reg("measure_audit_impact", { description: "Impact T+30/T+60/T+90 via GSC/GA4. Pro Agency required.", inputSchema: { type: "object" as const, properties: { domain: { type: "string" as const }, audit_id: { type: "string" as const } }, required: ["domain" as const] }, handler: handler('measure_audit_impact') });
reg("wordpress_sync", { description: "Inject fixes into WordPress via Bridge CMS. Pro Agency required.", inputSchema: { type: "object" as const, properties: { tracked_site_id: { type: "string" as const }, script_id: { type: "string" as const } }, required: ["tracked_site_id" as const, "script_id" as const] }, handler: handler('wordpress_sync') });
reg("fetch_serp_kpis", { description: "Weekly SERP KPIs: rankings, traffic, visibility. Pro Agency required.", inputSchema: { type: "object" as const, properties: { domain: { type: "string" as const }, tracked_site_id: { type: "string" as const } }, required: ["domain" as const] }, handler: handler('fetch_serp_kpis') });
reg("calculate_ias", { description: "Strategic Alignment Index (IAS). Pro Agency required.", inputSchema: { type: "object" as const, properties: { domain: { type: "string" as const }, tracked_site_id: { type: "string" as const } }, required: ["domain" as const] }, handler: handler('calculate_ias') });

const jobIdSchema = { type: "object" as const, properties: { job_id: { type: "string" as const, description: "Marina job UUID" } }, required: ["job_id" as const], additionalProperties: false };
reg("marina_create_report", { description: "Launch a Marina SEO+GEO audit report (40+ pages). Auth: x-marina-key or Bearer <key|JWT>. Cost: 5 credits, included with active Pro Agency. Returns job_id; poll with marina_get_report.", inputSchema: { type: "object" as const, properties: { url: { type: "string" as const, description: "URL à auditer (http/https ; un domaine nu est préfixé https://)" }, lang: { type: "string" as const, enum: ["fr", "en", "es"] }, callback_url: { type: "string" as const, description: "Webhook POST appelé en fin de job (http/https)" } }, required: ["url" as const], additionalProperties: false }, handler: marinaCreateReport });
reg("marina_get_report", { description: "Status / result of a Marina job owned by the caller. Free.", inputSchema: jobIdSchema, handler: marinaGetReport });
reg("marina_list_jobs", { description: "List the caller's Marina jobs (most recent first). Free.", inputSchema: { type: "object" as const, properties: { limit: { type: "integer" as const, minimum: 1, maximum: 50, default: 20 }, status: { type: "string" as const, enum: ["pending", "processing", "completed", "partial", "failed"] } }, additionalProperties: false }, handler: marinaListJobs });
reg("marina_export_pdf", { description: "Export a completed Marina report as PDF (signed URL valid 7 days). Free.", inputSchema: jobIdSchema, handler: marinaExportPdf });

// ── HTTP ────────────────────────────────────────────────

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);
const app = new Hono();

// CORS local : ajoute x-marina-key sans toucher _shared/cors.ts (partagé par toutes les fonctions).
const mcpCors: Record<string, string> = { ...corsHeaders, 'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-marina-key, mcp-session-id, mcp-protocol-version` };
const withCors = (r: Response) => { const h = new Headers(r.headers); Object.entries(mcpCors).forEach(([k, v]) => h.set(k, v)); return new Response(r.body, { status: r.status, headers: h }); };
const runInCtx = (c: any) => reqStore.run(
  { authorization: c.req.header('Authorization') || null, marinaKey: c.req.header('x-marina-key') || null },
  () => httpHandler(c.req.raw),
);

app.options('/*', (c) => c.newResponse(null, 204, { ...mcpCors, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' }));
app.get('/*', (c) => c.json({ status: 'ok', server: 'crawlers-mcp', version: SERVER_VERSION, tools: TOOL_COUNT, auth_headers: ['x-marina-key', 'Authorization: Bearer <clé Marina ou JWT>'], mcp_endpoint: 'POST /functions/v1/mcp-server', docs: 'https://crawlers.fr/mcp' }, 200, mcpCors));
app.post('/*', async (c) => withCors(await runInCtx(c)));
app.delete('/*', async (c) => withCors(await runInCtx(c)));

Deno.serve(app.fetch);
