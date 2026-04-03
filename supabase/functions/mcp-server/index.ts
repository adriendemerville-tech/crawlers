/**
 * MCP Server for Crawlers.fr — mcp-lite with raw JSON Schema (no zod needed)
 */
import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const FREE_TOOLS = new Set(['check_geo_score', 'check_llm_visibility', 'check_ai_crawlers']);
const TOOL_TO_FUNCTION: Record<string, string> = {
  check_geo_score: 'check-geo', check_llm_visibility: 'check-llm-depth', check_ai_crawlers: 'check-llm-depth',
  expert_seo_audit: 'audit-expert-seo', strategic_ai_audit: 'audit-strategique-ia',
  generate_corrective_code: 'generate-corrective-code', dry_run_script: 'process-script-queue',
  calculate_cocoon_logic: 'calculate-cocoon-logic', measure_audit_impact: 'auto-measure-predictions',
  wordpress_sync: 'wpsync', fetch_serp_kpis: 'fetch-serp-kpis', calculate_ias: 'calculate-ias',
};

async function checkKillSwitch(): Promise<boolean> {
  try { const { data } = await getServiceClient().from('system_config').select('value').eq('key', 'mcp_enabled').maybeSingle(); return !data || data.value !== false; } catch { return true; }
}

interface Auth { userId: string; planType: string; isAdmin: boolean; }

async function authenticate(ah: string | null): Promise<Auth | null> {
  if (!ah?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await getUserClient(ah).auth.getUser();
  if (error || !user) return null;
  const sb = getServiceClient();
  const [pr, ar] = await Promise.all([sb.from('profiles').select('plan_type, subscription_status').eq('user_id', user.id).single(), sb.rpc('has_role', { _user_id: user.id, _role: 'admin' })]);
  const p = pr.data; const isAdmin = ar.data === true;
  const isPro = p?.plan_type === 'agency_pro' && (p?.subscription_status === 'active' || p?.subscription_status === 'canceling');
  return { userId: user.id, planType: isPro ? 'agency_pro' : 'free', isAdmin };
}

async function rateOk(uid: string, tool: string): Promise<boolean> {
  try { const { data } = await getServiceClient().rpc('check_rate_limit', { p_user_id: uid, p_action: `mcp:${tool}`, p_max_count: 30, p_window_minutes: 60 }); return data?.allowed !== false; } catch { return true; }
}

async function log(uid: string | null, tool: string, params: unknown, status: string, err: string | null, ms: number) {
  try { await getServiceClient().from('mcp_usage_logs').insert({ user_id: uid, tool_name: tool, input_params: params, status, error_message: err, execution_time_ms: ms }); } catch {}
}

async function callFn(fn: string, body: unknown, auth?: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': auth || `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` };
  try { const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(body) }); const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; } if (!r.ok) return { data: null, error: `${r.status}: ${t.slice(0, 500)}` }; return { data: d, error: null }; } catch (e) { return { data: null, error: (e as Error).message }; }
}

let _ah: string | null = null;

function handler(tool: string) {
  return async (args: Record<string, unknown>) => {
    const t0 = Date.now(); const ah = _ah; const isFree = FREE_TOOLS.has(tool);
    if (!(await checkKillSwitch())) { await log(null, tool, args, 'blocked', 'disabled', Date.now() - t0); return { content: [{ type: 'text' as const, text: '🚫 MCP Crawlers temporairement désactivé.' }] }; }
    let auth: Auth | null = null;
    if (!isFree) {
      auth = await authenticate(ah);
      if (!auth) { await log(null, tool, args, 'unauthorized', 'no token', Date.now() - t0); return { content: [{ type: 'text' as const, text: '🔒 Pro Agency requis. https://crawlers.fr/tarifs' }] }; }
      if (!auth.isAdmin && auth.planType !== 'agency_pro') { await log(auth.userId, tool, args, 'forbidden', 'not pro', Date.now() - t0); return { content: [{ type: 'text' as const, text: '⚠️ Réservé Pro Agency. https://crawlers.fr/tarifs' }] }; }
      if (!(await rateOk(auth.userId, tool))) { await log(auth.userId, tool, args, 'rate_limited', '30/h', Date.now() - t0); return { content: [{ type: 'text' as const, text: '⏳ Limite 30/h atteinte.' }] }; }
    } else { auth = await authenticate(ah); }
    const res = await callFn(TOOL_TO_FUNCTION[tool], args, ah || undefined); const ms = Date.now() - t0;
    if (res.error) { await log(auth?.userId || null, tool, args, 'error', res.error, ms); return { content: [{ type: 'text' as const, text: `❌ ${res.error}` }] }; }
    await log(auth?.userId || null, tool, args, 'success', null, ms);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] };
  };
}

// ── MCP Server (no schemaAdapter = raw JSON Schema) ─────

const mcp = new McpServer({ name: "crawlers-fr", version: "1.0.0" });

const domainSchema = { type: "object" as const, properties: { domain: { type: "string" as const, description: "Domain e.g. example.com" } }, required: ["domain" as const] };
const urlSchema = { type: "object" as const, properties: { url: { type: "string" as const, description: "Full URL" } }, required: ["url" as const] };

mcp.tool("check_geo_score", { description: "GEO score (0-100) for AI engine optimization.", inputSchema: domainSchema, handler: handler('check_geo_score') });
mcp.tool("check_llm_visibility", { description: "Domain visibility across LLMs (ChatGPT, Gemini, Perplexity, Claude).", inputSchema: domainSchema, handler: handler('check_llm_visibility') });
mcp.tool("check_ai_crawlers", { description: "AI bot analysis (GPTBot, ClaudeBot, Google-Extended).", inputSchema: domainSchema, handler: handler('check_ai_crawlers') });

mcp.tool("expert_seo_audit", { description: "200-point SEO audit. Pro Agency required.", inputSchema: urlSchema, handler: handler('expert_seo_audit') });
mcp.tool("strategic_ai_audit", { description: "Strategic AI audit: SEO+GEO+competitive. Pro Agency required.", inputSchema: { type: "object" as const, properties: { url: { type: "string" as const }, sector: { type: "string" as const } }, required: ["url" as const] }, handler: handler('strategic_ai_audit') });
mcp.tool("generate_corrective_code", { description: "Generate JS corrective code for SEO/GEO fixes. Pro Agency required.", inputSchema: { type: "object" as const, properties: { url: { type: "string" as const }, audit_id: { type: "string" as const } }, required: ["url" as const] }, handler: handler('generate_corrective_code') });
mcp.tool("dry_run_script", { description: "Sandbox test of corrective script. Pro Agency required.", inputSchema: { type: "object" as const, properties: { script_id: { type: "string" as const }, target_url: { type: "string" as const } }, required: ["script_id" as const, "target_url" as const] }, handler: handler('dry_run_script') });
mcp.tool("calculate_cocoon_logic", { description: "Semantic cocoon via TF-IDF. Pro Agency required.", inputSchema: { type: "object" as const, properties: { domain: { type: "string" as const }, tracked_site_id: { type: "string" as const } }, required: ["domain" as const, "tracked_site_id" as const] }, handler: handler('calculate_cocoon_logic') });
mcp.tool("measure_audit_impact", { description: "Impact T+30/T+60/T+90 via GSC/GA4. Pro Agency required.", inputSchema: { type: "object" as const, properties: { domain: { type: "string" as const }, audit_id: { type: "string" as const } }, required: ["domain" as const] }, handler: handler('measure_audit_impact') });
mcp.tool("wordpress_sync", { description: "Inject fixes into WordPress via Bridge CMS. Pro Agency required.", inputSchema: { type: "object" as const, properties: { tracked_site_id: { type: "string" as const }, script_id: { type: "string" as const } }, required: ["tracked_site_id" as const, "script_id" as const] }, handler: handler('wordpress_sync') });
mcp.tool("fetch_serp_kpis", { description: "Weekly SERP KPIs: rankings, traffic, visibility. Pro Agency required.", inputSchema: { type: "object" as const, properties: { domain: { type: "string" as const }, tracked_site_id: { type: "string" as const } }, required: ["domain" as const] }, handler: handler('fetch_serp_kpis') });
mcp.tool("calculate_ias", { description: "Strategic Alignment Index (IAS). Pro Agency required.", inputSchema: { type: "object" as const, properties: { domain: { type: "string" as const }, tracked_site_id: { type: "string" as const } }, required: ["domain" as const] }, handler: handler('calculate_ias') });

// ── HTTP ────────────────────────────────────────────────

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);
const app = new Hono();

app.options('/*', (c) => c.newResponse(null, 204, { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' }));
app.get('/*', (c) => c.json({ status: 'ok', server: 'crawlers-mcp', version: '1.0.0', tools: 12, mcp_endpoint: 'POST /functions/v1/mcp-server', docs: 'https://crawlers.fr/mcp' }));
app.post('/*', async (c) => { _ah = c.req.header('Authorization') || null; const r = await httpHandler(c.req.raw); const h = new Headers(r.headers); Object.entries(corsHeaders).forEach(([k, v]) => h.set(k, v)); return new Response(r.body, { status: r.status, headers: h }); });
app.delete('/*', async (c) => { const r = await httpHandler(c.req.raw); const h = new Headers(r.headers); Object.entries(corsHeaders).forEach(([k, v]) => h.set(k, v)); return new Response(r.body, { status: r.status, headers: h }); });

Deno.serve(app.fetch);