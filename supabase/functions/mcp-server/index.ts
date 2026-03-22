/**
 * MCP Server for Crawlers.fr
 * 
 * Uses mcp-lite with Hono + Zod for Supabase Edge Functions.
 */
import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { z } from "zod";
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

const FREE_TOOLS = new Set(['check_geo_score', 'check_llm_visibility', 'check_ai_crawlers']);

const TOOL_TO_FUNCTION: Record<string, string> = {
  check_geo_score: 'check-geo',
  check_llm_visibility: 'check-llm-depth',
  check_ai_crawlers: 'check-llm-depth',
  expert_seo_audit: 'audit-expert-seo',
  strategic_ai_audit: 'audit-strategique-ia',
  generate_corrective_code: 'generate-corrective-code',
  dry_run_script: 'process-script-queue',
  calculate_cocoon_logic: 'calculate-cocoon-logic',
  measure_audit_impact: 'auto-measure-predictions',
  wordpress_sync: 'wpsync',
  fetch_serp_kpis: 'fetch-serp-kpis',
  calculate_ias: 'calculate-ias',
};

// ── Helpers ─────────────────────────────────────────────

async function checkKillSwitch(): Promise<boolean> {
  try {
    const sb = getServiceClient();
    const { data } = await sb.from('system_config').select('value').eq('key', 'mcp_enabled').maybeSingle();
    if (!data) return true;
    return data.value !== false;
  } catch { return true; }
}

interface AuthResult { userId: string; planType: 'free' | 'agency_pro'; isAdmin: boolean; }

async function authenticateToken(authHeader: string | null): Promise<AuthResult | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const uc = getUserClient(authHeader);
  const { data: { user }, error } = await uc.auth.getUser();
  if (error || !user) return null;
  const sb = getServiceClient();
  const [pr, ar] = await Promise.all([
    sb.from('profiles').select('plan_type, subscription_status').eq('user_id', user.id).single(),
    sb.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
  ]);
  const p = pr.data;
  const isAdmin = ar.data === true;
  const isPro = p?.plan_type === 'agency_pro' && (p?.subscription_status === 'active' || p?.subscription_status === 'canceling');
  return { userId: user.id, planType: isPro ? 'agency_pro' : 'free', isAdmin };
}

async function checkRateLimit(userId: string, toolName: string): Promise<boolean> {
  try {
    const sb = getServiceClient();
    const { data } = await sb.rpc('check_rate_limit', { p_user_id: userId, p_action: `mcp:${toolName}`, p_max_count: 30, p_window_minutes: 60 });
    return data?.allowed !== false;
  } catch { return true; }
}

async function logUsage(userId: string | null, toolName: string, params: Record<string, unknown>, status: string, err: string | null, ms: number) {
  try {
    await getServiceClient().from('mcp_usage_logs').insert({ user_id: userId, tool_name: toolName, input_params: params, status, error_message: err, execution_time_ms: ms });
  } catch (e) { console.error('[MCP] log:', e); }
}

async function callFn(fn: string, body: Record<string, unknown>, auth?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': auth || `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` };
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const t = await r.text();
    let d: unknown;
    try { d = JSON.parse(t); } catch { d = { raw: t }; }
    if (!r.ok) return { data: null, error: `${r.status}: ${t.slice(0, 500)}` };
    return { data: d, error: null };
  } catch (e) { return { data: null, error: (e as Error).message }; }
}

// Store current auth header per request
let _authHeader: string | null = null;

function makeHandler(toolName: string) {
  return async (args: Record<string, unknown>) => {
    const t0 = Date.now();
    const isFree = FREE_TOOLS.has(toolName);
    const ah = _authHeader;

    if (!(await checkKillSwitch())) {
      await logUsage(null, toolName, args, 'blocked', 'disabled', Date.now() - t0);
      return { content: [{ type: 'text' as const, text: '🚫 Serveur MCP Crawlers temporairement désactivé.' }] };
    }

    let auth: AuthResult | null = null;
    if (!isFree) {
      auth = await authenticateToken(ah);
      if (!auth) {
        await logUsage(null, toolName, args, 'unauthorized', 'no token', Date.now() - t0);
        return { content: [{ type: 'text' as const, text: '🔒 Abonnement Pro Agency requis.\nhttps://crawlers.fr/tarifs' }] };
      }
      if (!auth.isAdmin && auth.planType !== 'agency_pro') {
        await logUsage(auth.userId, toolName, args, 'forbidden', 'not pro', Date.now() - t0);
        return { content: [{ type: 'text' as const, text: '⚠️ Réservé Pro Agency.\nhttps://crawlers.fr/tarifs' }] };
      }
      if (!(await checkRateLimit(auth.userId, toolName))) {
        await logUsage(auth.userId, toolName, args, 'rate_limited', '30/h', Date.now() - t0);
        return { content: [{ type: 'text' as const, text: '⏳ Limite 30/h atteinte.' }] };
      }
    } else {
      auth = await authenticateToken(ah);
    }

    const fn = TOOL_TO_FUNCTION[toolName];
    const res = await callFn(fn, args, ah || undefined);
    const ms = Date.now() - t0;

    if (res.error) {
      await logUsage(auth?.userId || null, toolName, args, 'error', res.error, ms);
      return { content: [{ type: 'text' as const, text: `❌ ${res.error}` }] };
    }

    await logUsage(auth?.userId || null, toolName, args, 'success', null, ms);
    return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] };
  };
}

// ── MCP Server ──────────────────────────────────────────

const mcp = new McpServer({
  name: "crawlers-fr",
  version: "1.0.0",
  schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
});

// Free tier
mcp.tool("check_geo_score", {
  description: "GEO score (0-100) — optimization for AI engines (ChatGPT, Gemini, Perplexity, Claude).",
  inputSchema: z.object({ domain: z.string().describe("Domain e.g. example.com") }),
  handler: makeHandler('check_geo_score'),
});

mcp.tool("check_llm_visibility", {
  description: "Domain visibility across LLMs (ChatGPT, Gemini, Perplexity, Claude, Mistral, Llama).",
  inputSchema: z.object({ domain: z.string().describe("Domain e.g. example.com") }),
  handler: makeHandler('check_llm_visibility'),
});

mcp.tool("check_ai_crawlers", {
  description: "AI bot analysis (GPTBot, ClaudeBot, Google-Extended, Bytespider). Robots.txt check.",
  inputSchema: z.object({ domain: z.string().describe("Domain e.g. example.com") }),
  handler: makeHandler('check_ai_crawlers'),
});

// Pro tier
mcp.tool("expert_seo_audit", {
  description: "200-point SEO audit: technical, on-page, structured data, Core Web Vitals. Pro Agency required.",
  inputSchema: z.object({ url: z.string().describe("Full URL to audit") }),
  handler: makeHandler('expert_seo_audit'),
});

mcp.tool("strategic_ai_audit", {
  description: "Strategic AI audit: SEO + GEO + competitive analysis with LLM reasoning. Pro Agency required.",
  inputSchema: z.object({ url: z.string().describe("URL to audit"), sector: z.string().optional().describe("Business sector") }),
  handler: makeHandler('strategic_ai_audit'),
});

mcp.tool("generate_corrective_code", {
  description: "Generate JS corrective code for SEO/GEO fixes. Deployable via GTM. Pro Agency required.",
  inputSchema: z.object({ url: z.string().describe("URL audited"), audit_id: z.string().optional().describe("Audit ID") }),
  handler: makeHandler('generate_corrective_code'),
});

mcp.tool("dry_run_script", {
  description: "Sandbox test of corrective script. Simulated DOM changes + safety check. Pro Agency required.",
  inputSchema: z.object({ script_id: z.string().describe("Script ID"), target_url: z.string().describe("Target URL") }),
  handler: makeHandler('dry_run_script'),
});

mcp.tool("calculate_cocoon_logic", {
  description: "Semantic cocoon via TF-IDF: topical clusters, internal linking, content hierarchy. Pro Agency required.",
  inputSchema: z.object({ domain: z.string().describe("Domain"), tracked_site_id: z.string().describe("Tracked site ID") }),
  handler: makeHandler('calculate_cocoon_logic'),
});

mcp.tool("measure_audit_impact", {
  description: "Impact measurement at T+30/T+60/T+90 using GSC and GA4 data. Pro Agency required.",
  inputSchema: z.object({ domain: z.string().describe("Domain"), audit_id: z.string().optional().describe("Audit ID") }),
  handler: makeHandler('measure_audit_impact'),
});

mcp.tool("wordpress_sync", {
  description: "Inject SEO fixes into WordPress via Crawlers Bridge CMS with rollback. Pro Agency required.",
  inputSchema: z.object({ tracked_site_id: z.string().describe("Tracked site ID"), script_id: z.string().describe("Script ID") }),
  handler: makeHandler('wordpress_sync'),
});

mcp.tool("fetch_serp_kpis", {
  description: "Weekly SERP KPIs: rankings, positions, traffic, visibility, competitors. Pro Agency required.",
  inputSchema: z.object({ domain: z.string().describe("Domain"), tracked_site_id: z.string().optional().describe("Tracked site ID") }),
  handler: makeHandler('fetch_serp_kpis'),
});

mcp.tool("calculate_ias", {
  description: "Strategic Alignment Index (IAS) — content strategy vs search intent + AI engines. Pro Agency required.",
  inputSchema: z.object({ domain: z.string().describe("Domain"), tracked_site_id: z.string().optional().describe("Tracked site ID") }),
  handler: makeHandler('calculate_ias'),
});

// ── HTTP ────────────────────────────────────────────────

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

const app = new Hono();

app.options('/*', (c) => c.newResponse(null, 204, { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' }));

app.get('/*', (c) => c.json({
  status: 'ok', server: 'crawlers-mcp', version: '1.0.0',
  tools: Object.keys(TOOL_TO_FUNCTION).length,
  mcp_endpoint: 'POST /functions/v1/mcp-server',
  docs: 'https://crawlers.fr/mcp',
}));

app.post('/*', async (c) => {
  _authHeader = c.req.header('Authorization') || null;
  const response = await httpHandler(c.req.raw);
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
});

app.delete('/*', async (c) => {
  const response = await httpHandler(c.req.raw);
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
});

Deno.serve(app.fetch);
