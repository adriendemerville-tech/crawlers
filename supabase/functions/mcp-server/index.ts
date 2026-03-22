/**
 * MCP Server for Crawlers.fr
 * 
 * Exposes Crawlers SEO/GEO tools via the official MCP SDK.
 * Stateless Streamable HTTP transport for Edge Functions.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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

interface AuthResult { userId: string; email: string; planType: 'free' | 'agency_pro'; isAdmin: boolean; }

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
  return { userId: user.id, email: user.email || '', planType: isPro ? 'agency_pro' : 'free', isAdmin };
}

async function checkRateLimit(userId: string, toolName: string): Promise<boolean> {
  try {
    const sb = getServiceClient();
    const { data } = await sb.rpc('check_rate_limit', { p_user_id: userId, p_action: `mcp:${toolName}`, p_max_count: 30, p_window_minutes: 60 });
    return data?.allowed !== false;
  } catch { return true; }
}

async function logMcpUsage(userId: string | null, toolName: string, inputParams: Record<string, unknown>, status: string, errorMessage: string | null, executionTimeMs: number) {
  try {
    const sb = getServiceClient();
    await sb.from('mcp_usage_logs').insert({ user_id: userId, tool_name: toolName, input_params: inputParams, status, error_message: errorMessage, execution_time_ms: executionTimeMs });
  } catch (e) { console.error('[MCP] log failed:', e); }
}

async function callEdgeFunction(fn: string, body: Record<string, unknown>, authHeader?: string) {
  const url = `${SUPABASE_URL}/functions/v1/${fn}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': authHeader || `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` };
  try {
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await resp.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!resp.ok) return { data: null, error: `${resp.status}: ${text.slice(0, 500)}` };
    return { data, error: null };
  } catch (e) { return { data: null, error: (e as Error).message }; }
}

// ── Tool handler factory ────────────────────────────────

function makeHandler(toolName: string) {
  return async (args: Record<string, unknown>, extra: { authInfo?: { token?: string }; _meta?: unknown }) => {
    const startTime = Date.now();
    const isFree = FREE_TOOLS.has(toolName);
    // Extract auth from extra context - MCP SDK passes authInfo
    const authHeader = extra?.authInfo?.token ? `Bearer ${extra.authInfo.token}` : null;

    const enabled = await checkKillSwitch();
    if (!enabled) {
      await logMcpUsage(null, toolName, args, 'blocked', 'MCP disabled', Date.now() - startTime);
      return { content: [{ type: 'text' as const, text: '🚫 Serveur MCP Crawlers temporairement désactivé.' }] };
    }

    let auth: AuthResult | null = null;
    if (!isFree) {
      auth = await authenticateToken(authHeader);
      if (!auth) {
        await logMcpUsage(null, toolName, args, 'unauthorized', 'No token', Date.now() - startTime);
        return { content: [{ type: 'text' as const, text: '🔒 Cet outil nécessite un abonnement Pro Agency.\nAbonnez-vous sur https://crawlers.fr/tarifs' }] };
      }
      if (!auth.isAdmin && auth.planType !== 'agency_pro') {
        await logMcpUsage(auth.userId, toolName, args, 'forbidden', 'Not Pro', Date.now() - startTime);
        return { content: [{ type: 'text' as const, text: '⚠️ Réservé aux abonnés Pro Agency. https://crawlers.fr/tarifs' }] };
      }
      if (!(await checkRateLimit(auth.userId, toolName))) {
        await logMcpUsage(auth.userId, toolName, args, 'rate_limited', '30/h', Date.now() - startTime);
        return { content: [{ type: 'text' as const, text: '⏳ Limite atteinte (30/h). Réessayez dans quelques minutes.' }] };
      }
    } else {
      auth = await authenticateToken(authHeader);
    }

    const fn = TOOL_TO_FUNCTION[toolName];
    const result = await callEdgeFunction(fn, args, authHeader || undefined);
    const ms = Date.now() - startTime;

    if (result.error) {
      await logMcpUsage(auth?.userId || null, toolName, args, 'error', result.error, ms);
      return { content: [{ type: 'text' as const, text: `❌ Erreur : ${result.error}` }] };
    }

    await logMcpUsage(auth?.userId || null, toolName, args, 'success', null, ms);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
  };
}

// ── Main handler ────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' } });
  }

  // Health / info
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'ok',
      server: 'crawlers-mcp',
      version: '1.0.0',
      tools: Object.keys(TOOL_TO_FUNCTION).length,
      endpoint: 'POST /functions/v1/mcp-server',
      docs: 'https://crawlers.fr/mcp',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // MCP protocol via Streamable HTTP
  if (req.method === 'POST' || req.method === 'DELETE') {
    try {
      // Create a fresh server + transport per request (stateless)
      const server = new McpServer({ name: "crawlers-fr", version: "1.0.0" });

      // Register tools
      server.tool("check_geo_score",
        "Calculate the GEO score (0-100) for a domain — optimization for AI engines (ChatGPT, Gemini, Perplexity, Claude).",
        { domain: z.string().describe("Domain (e.g. example.com)") },
        makeHandler('check_geo_score'),
      );

      server.tool("check_llm_visibility",
        "Check domain visibility across LLMs (ChatGPT, Gemini, Perplexity, Claude, Mistral, Llama). Citation rates and scores.",
        { domain: z.string().describe("Domain (e.g. example.com)") },
        makeHandler('check_llm_visibility'),
      );

      server.tool("check_ai_crawlers",
        "Analyze AI bots crawling a site (GPTBot, ClaudeBot, Google-Extended, Bytespider). Robots.txt analysis and recommendations.",
        { domain: z.string().describe("Domain (e.g. example.com)") },
        makeHandler('check_ai_crawlers'),
      );

      server.tool("expert_seo_audit",
        "200-point SEO audit: technical SEO, on-page, structured data, Core Web Vitals, accessibility, security. Requires Pro Agency.",
        { url: z.string().describe("Full URL to audit") },
        makeHandler('expert_seo_audit'),
      );

      server.tool("strategic_ai_audit",
        "Strategic AI audit: SEO + GEO readiness + competitive positioning + content gaps with LLM reasoning. Requires Pro Agency.",
        { url: z.string().describe("URL to audit"), sector: z.string().optional().describe("Business sector") },
        makeHandler('strategic_ai_audit'),
      );

      server.tool("generate_corrective_code",
        "Generate JavaScript to fix SEO/GEO issues from an audit. Deployable via GTM or direct injection. Requires Pro Agency.",
        { url: z.string().describe("URL audited"), audit_id: z.string().optional().describe("Audit ID") },
        makeHandler('generate_corrective_code'),
      );

      server.tool("dry_run_script",
        "Test a corrective script in sandbox mode. Simulated DOM changes and safety assessment. Requires Pro Agency.",
        { script_id: z.string().describe("Script ID"), target_url: z.string().describe("URL to simulate on") },
        makeHandler('dry_run_script'),
      );

      server.tool("calculate_cocoon_logic",
        "Generate semantic cocoon (cocon sémantique) via TF-IDF: topical clusters, internal linking, content hierarchy. Requires Pro Agency.",
        { domain: z.string().describe("Domain"), tracked_site_id: z.string().describe("Tracked site ID") },
        makeHandler('calculate_cocoon_logic'),
      );

      server.tool("measure_audit_impact",
        "Measure SEO/GEO correction impact at T+30/T+60/T+90 days using GSC and GA4 data. Requires Pro Agency.",
        { domain: z.string().describe("Domain"), audit_id: z.string().optional().describe("Audit ID") },
        makeHandler('measure_audit_impact'),
      );

      server.tool("wordpress_sync",
        "Inject SEO fixes into WordPress via Crawlers Bridge CMS plugin with rollback. Requires Pro Agency.",
        { tracked_site_id: z.string().describe("Tracked site ID"), script_id: z.string().describe("Script ID") },
        makeHandler('wordpress_sync'),
      );

      server.tool("fetch_serp_kpis",
        "Weekly SERP KPIs: rankings, position changes, traffic, visibility, competitors. Requires Pro Agency.",
        { domain: z.string().describe("Domain"), tracked_site_id: z.string().optional().describe("Tracked site ID") },
        makeHandler('fetch_serp_kpis'),
      );

      server.tool("calculate_ias",
        "Strategic Alignment Index (IAS) — proprietary score for content strategy vs search intent and AI engines. Requires Pro Agency.",
        { domain: z.string().describe("Domain"), tracked_site_id: z.string().optional().describe("Tracked site ID") },
        makeHandler('calculate_ias'),
      );

      // Stateless transport
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);

      const response = await transport.handleRequest(req);
      // Add CORS
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(response.body, { status: response.status, headers });
    } catch (e) {
      console.error('[MCP] Error:', e);
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
