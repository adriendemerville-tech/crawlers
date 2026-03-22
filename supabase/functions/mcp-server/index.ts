/**
 * MCP Server for Crawlers.fr
 * 
 * Exposes Crawlers SEO/GEO tools as MCP-compatible endpoints.
 */
import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

const FREE_TOOLS = new Set([
  'check_geo_score',
  'check_llm_visibility',
  'check_ai_crawlers',
]);

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
    const supabase = getServiceClient();
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'mcp_enabled')
      .maybeSingle();
    if (!data) return true;
    return data.value !== false;
  } catch {
    return true;
  }
}

interface AuthResult {
  userId: string;
  email: string;
  planType: 'free' | 'agency_pro';
  isAdmin: boolean;
}

async function authenticateToken(authHeader: string | null): Promise<AuthResult | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const userClient = getUserClient(authHeader);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  const supabase = getServiceClient();
  const [profileResult, adminResult] = await Promise.all([
    supabase.from('profiles').select('plan_type, subscription_status').eq('user_id', user.id).single(),
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
  ]);

  const profile = profileResult.data;
  const isAdmin = adminResult.data === true;
  const isActivePro = profile?.plan_type === 'agency_pro' &&
    (profile?.subscription_status === 'active' || profile?.subscription_status === 'canceling');

  return { userId: user.id, email: user.email || '', planType: isActivePro ? 'agency_pro' : 'free', isAdmin };
}

async function checkRateLimit(userId: string, toolName: string): Promise<boolean> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId, p_action: `mcp:${toolName}`, p_max_count: 30, p_window_minutes: 60,
    });
    return data?.allowed !== false;
  } catch {
    return true;
  }
}

async function logMcpUsage(userId: string | null, toolName: string, inputParams: Record<string, unknown>, status: string, errorMessage: string | null, executionTimeMs: number) {
  try {
    const supabase = getServiceClient();
    await supabase.from('mcp_usage_logs').insert({ user_id: userId, tool_name: toolName, input_params: inputParams, status, error_message: errorMessage, execution_time_ms: executionTimeMs });
  } catch (e) {
    console.error('[MCP] log failed:', e);
  }
}

async function callEdgeFunction(functionName: string, body: Record<string, unknown>, authHeader?: string) {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': authHeader || `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
  };
  try {
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await resp.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!resp.ok) return { data: null, error: `${resp.status}: ${text.slice(0, 500)}`, status: resp.status };
    return { data, error: null, status: resp.status };
  } catch (e) {
    return { data: null, error: (e as Error).message, status: 500 };
  }
}

// ── Shared handler ──────────────────────────────────────

// We store the raw request per invocation so tool handlers can read auth
let _currentAuthHeader: string | null = null;

async function handleTool(toolName: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();
  const isFree = FREE_TOOLS.has(toolName);
  const authHeader = _currentAuthHeader;

  const enabled = await checkKillSwitch();
  if (!enabled) {
    await logMcpUsage(null, toolName, args, 'blocked_killswitch', 'MCP disabled', Date.now() - startTime);
    return { content: [{ type: 'text', text: '🚫 Le serveur MCP Crawlers est temporairement désactivé.' }] };
  }

  let auth: AuthResult | null = null;
  if (!isFree) {
    auth = await authenticateToken(authHeader);
    if (!auth) {
      await logMcpUsage(null, toolName, args, 'unauthorized', 'No valid token', Date.now() - startTime);
      return { content: [{ type: 'text', text: '🔒 Cet outil nécessite un abonnement Pro Agency.\nAbonnez-vous sur https://crawlers.fr/tarifs' }] };
    }
    if (!auth.isAdmin && auth.planType !== 'agency_pro') {
      await logMcpUsage(auth.userId, toolName, args, 'forbidden', 'Not Pro', Date.now() - startTime);
      return { content: [{ type: 'text', text: '⚠️ Réservé aux abonnés Pro Agency.\nhttps://crawlers.fr/tarifs' }] };
    }
    const allowed = await checkRateLimit(auth.userId, toolName);
    if (!allowed) {
      await logMcpUsage(auth.userId, toolName, args, 'rate_limited', 'Too many requests', Date.now() - startTime);
      return { content: [{ type: 'text', text: '⏳ Limite atteinte (30/h). Réessayez dans quelques minutes.' }] };
    }
  } else {
    auth = await authenticateToken(authHeader);
  }

  const functionName = TOOL_TO_FUNCTION[toolName];
  if (!functionName) return { content: [{ type: 'text', text: `❌ Outil inconnu : ${toolName}` }] };

  const result = await callEdgeFunction(functionName, args, authHeader || undefined);
  const executionTime = Date.now() - startTime;

  if (result.error) {
    await logMcpUsage(auth?.userId || null, toolName, args, 'error', result.error, executionTime);
    return { content: [{ type: 'text', text: `❌ Erreur : ${result.error}` }] };
  }

  await logMcpUsage(auth?.userId || null, toolName, args, 'success', null, executionTime);
  return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
}

// ── Build MCP Server ────────────────────────────────────

const mcp = new McpServer({ name: "crawlers-fr", version: "1.0.0" });

// Free tools
mcp.tool("check_geo_score", {
  description: "Calculate the GEO score (0-100) for a domain — measures optimization for AI engines (ChatGPT, Gemini, Perplexity, Claude).",
  inputSchema: { type: "object", properties: { domain: { type: "string", description: "Domain (e.g. example.com)" } }, required: ["domain"] },
  handler: (args: { domain: string }) => handleTool('check_geo_score', args),
});

mcp.tool("check_llm_visibility", {
  description: "Check domain visibility across major LLMs (ChatGPT, Gemini, Perplexity, Claude, Mistral, Llama). Returns citation rates and recommendation scores.",
  inputSchema: { type: "object", properties: { domain: { type: "string", description: "Domain (e.g. example.com)" } }, required: ["domain"] },
  handler: (args: { domain: string }) => handleTool('check_llm_visibility', args),
});

mcp.tool("check_ai_crawlers", {
  description: "Analyze which AI bots crawl a site (GPTBot, ClaudeBot, Google-Extended, Bytespider). Returns robots.txt analysis and blocking recommendations.",
  inputSchema: { type: "object", properties: { domain: { type: "string", description: "Domain (e.g. example.com)" } }, required: ["domain"] },
  handler: (args: { domain: string }) => handleTool('check_ai_crawlers', args),
});

// Pro tools
mcp.tool("expert_seo_audit", {
  description: "Run a 200-point SEO audit: technical SEO, on-page, structured data, Core Web Vitals, accessibility, security.",
  inputSchema: { type: "object", properties: { url: { type: "string", description: "Full URL to audit" } }, required: ["url"] },
  handler: (args: { url: string }) => handleTool('expert_seo_audit', args),
});

mcp.tool("strategic_ai_audit", {
  description: "Strategic AI-powered audit: SEO signals, GEO readiness, competitive positioning, content gap analysis with LLM reasoning.",
  inputSchema: { type: "object", properties: { url: { type: "string", description: "URL to audit" }, sector: { type: "string", description: "Business sector (optional)" } }, required: ["url"] },
  handler: (args: { url: string; sector?: string }) => handleTool('strategic_ai_audit', args),
});

mcp.tool("generate_corrective_code", {
  description: "Generate JavaScript corrective code to fix SEO/GEO issues from an audit. Returns deployable JS snippets.",
  inputSchema: { type: "object", properties: { url: { type: "string", description: "URL audited" }, audit_id: { type: "string", description: "Audit ID (optional)" } }, required: ["url"] },
  handler: (args: { url: string; audit_id?: string }) => handleTool('generate_corrective_code', args),
});

mcp.tool("dry_run_script", {
  description: "Test a corrective script in sandbox before deploying. Returns simulated DOM changes and safety assessment.",
  inputSchema: { type: "object", properties: { script_id: { type: "string", description: "Script ID" }, target_url: { type: "string", description: "URL to simulate on" } }, required: ["script_id", "target_url"] },
  handler: (args: { script_id: string; target_url: string }) => handleTool('dry_run_script', args),
});

mcp.tool("calculate_cocoon_logic", {
  description: "Generate a semantic cocoon structure using TF-IDF: topical clusters, internal linking, content hierarchy.",
  inputSchema: { type: "object", properties: { domain: { type: "string", description: "Domain" }, tracked_site_id: { type: "string", description: "Tracked site ID" } }, required: ["domain", "tracked_site_id"] },
  handler: (args: { domain: string; tracked_site_id: string }) => handleTool('calculate_cocoon_logic', args),
});

mcp.tool("measure_audit_impact", {
  description: "Measure real-world impact of SEO/GEO corrections at T+30/T+60/T+90. Correlates with GSC and GA4 data.",
  inputSchema: { type: "object", properties: { domain: { type: "string", description: "Domain" }, audit_id: { type: "string", description: "Audit ID (optional)" } }, required: ["domain"] },
  handler: (args: { domain: string; audit_id?: string }) => handleTool('measure_audit_impact', args),
});

mcp.tool("wordpress_sync", {
  description: "Inject SEO fixes into WordPress via Crawlers Bridge CMS plugin with rollback capability.",
  inputSchema: { type: "object", properties: { tracked_site_id: { type: "string", description: "Tracked site ID" }, script_id: { type: "string", description: "Script to deploy" } }, required: ["tracked_site_id", "script_id"] },
  handler: (args: { tracked_site_id: string; script_id: string }) => handleTool('wordpress_sync', args),
});

mcp.tool("fetch_serp_kpis", {
  description: "Weekly SERP KPIs: keyword rankings, position changes, traffic estimates, visibility score, competitor comparison.",
  inputSchema: { type: "object", properties: { domain: { type: "string", description: "Domain" }, tracked_site_id: { type: "string", description: "Tracked site ID" } }, required: ["domain"] },
  handler: (args: { domain: string; tracked_site_id?: string }) => handleTool('fetch_serp_kpis', args),
});

mcp.tool("calculate_ias", {
  description: "Calculate the Strategic Alignment Index (IAS) — proprietary score for content strategy alignment with search intent and AI engines.",
  inputSchema: { type: "object", properties: { domain: { type: "string", description: "Domain" }, tracked_site_id: { type: "string", description: "Tracked site ID" } }, required: ["domain"] },
  handler: (args: { domain: string; tracked_site_id?: string }) => handleTool('calculate_ias', args),
});

// ── HTTP Transport ──────────────────────────────────────

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);
const app = new Hono();

app.options('/*', (c) => c.newResponse(null, 204, { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' }));

app.get('/', (c) => c.json({ status: 'ok', server: 'crawlers-mcp', version: '1.0.0', tools: Object.keys(TOOL_TO_FUNCTION).length }));

app.all('/mcp', async (c) => {
  _currentAuthHeader = c.req.header('Authorization') || null;
  const response = await httpHandler(c.req.raw);
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
});

// Fallback: route root POST to MCP too (for clients that call /functions/v1/mcp-server directly)
app.post('/', async (c) => {
  _currentAuthHeader = c.req.header('Authorization') || null;
  const response = await httpHandler(c.req.raw);
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
});

Deno.serve(app.fetch);
