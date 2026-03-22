/**
 * MCP Server for Crawlers.fr
 * 
 * Exposes Crawlers SEO/GEO tools as MCP-compatible endpoints
 * consumable by Claude, and any MCP-compatible client.
 * 
 * Tier Free: check_geo_score, check_llm_visibility, check_ai_crawlers
 * Tier Pro Agency: expert_seo_audit, strategic_ai_audit, generate_corrective_code,
 *   dry_run_script, calculate_cocoon_logic, measure_audit_impact, wordpress_sync,
 *   fetch_serp_kpis, calculate_ias
 */
import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

// ── Constants ───────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FREE_TOOLS = new Set([
  'check_geo_score',
  'check_llm_visibility', 
  'check_ai_crawlers',
]);

// Map MCP tool names → Edge Function names
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
    // If no config entry, default to enabled
    if (!data) return true;
    return data.value !== false;
  } catch {
    return true; // fail-open
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
    supabase
      .from('profiles')
      .select('plan_type, subscription_status')
      .eq('user_id', user.id)
      .single(),
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
  ]);

  const profile = profileResult.data;
  const isAdmin = adminResult.data === true;
  const isActivePro = profile?.plan_type === 'agency_pro' &&
    (profile?.subscription_status === 'active' || profile?.subscription_status === 'canceling');

  return {
    userId: user.id,
    email: user.email || '',
    planType: isActivePro ? 'agency_pro' : 'free',
    isAdmin,
  };
}

async function checkRateLimit(userId: string, toolName: string): Promise<boolean> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_action: `mcp:${toolName}`,
      p_max_count: 30,
      p_window_minutes: 60,
    });
    return data?.allowed !== false;
  } catch {
    return true; // fail-open
  }
}

async function logMcpUsage(
  userId: string | null,
  toolName: string,
  inputParams: Record<string, unknown>,
  status: string,
  errorMessage: string | null,
  executionTimeMs: number,
) {
  try {
    const supabase = getServiceClient();
    await supabase.from('mcp_usage_logs').insert({
      user_id: userId,
      tool_name: toolName,
      input_params: inputParams,
      status,
      error_message: errorMessage,
      execution_time_ms: executionTimeMs,
    });
  } catch (e) {
    console.error('[MCP] Failed to log usage:', e);
  }
}

async function callEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
  authHeader?: string,
): Promise<{ data: unknown; error: string | null; status: number }> {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': authHeader || `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      return { data: null, error: `Edge function returned ${resp.status}: ${text.slice(0, 500)}`, status: resp.status };
    }
    return { data, error: null, status: resp.status };
  } catch (e) {
    return { data: null, error: `Failed to call ${functionName}: ${(e as Error).message}`, status: 500 };
  }
}

// ── MCP Tool Handler (shared logic) ────────────────────

async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  authHeader: string | null,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();
  const isFree = FREE_TOOLS.has(toolName);

  // 1. Kill switch
  const enabled = await checkKillSwitch();
  if (!enabled) {
    await logMcpUsage(null, toolName, args, 'blocked_killswitch', 'MCP disabled', Date.now() - startTime);
    return { content: [{ type: 'text', text: '🚫 Le serveur MCP Crawlers est temporairement désactivé. Réessayez plus tard.' }] };
  }

  // 2. Auth for pro tools
  let auth: AuthResult | null = null;
  if (!isFree) {
    auth = await authenticateToken(authHeader);
    if (!auth) {
      await logMcpUsage(null, toolName, args, 'unauthorized', 'No valid token', Date.now() - startTime);
      return {
        content: [{
          type: 'text',
          text: '🔒 Cet outil nécessite un abonnement Pro Agency.\n\nAbonnez-vous sur https://crawlers.fr/tarifs pour accéder à l\'audit expert, au code correctif, au cocon sémantique et à tous les outils avancés.\n\nPrix : 59€/mois — essai gratuit pour les 100 premiers inscrits.',
        }],
      };
    }

    if (!auth.isAdmin && auth.planType !== 'agency_pro') {
      await logMcpUsage(auth.userId, toolName, args, 'forbidden', 'Not Pro Agency', Date.now() - startTime);
      return {
        content: [{
          type: 'text',
          text: '⚠️ Cet outil est réservé aux abonnés Pro Agency.\n\nVotre compte est actuellement sur le plan gratuit. Passez à Pro Agency sur https://crawlers.fr/tarifs pour débloquer tous les outils MCP.',
        }],
      };
    }

    // Rate limit
    const allowed = await checkRateLimit(auth.userId, toolName);
    if (!allowed) {
      await logMcpUsage(auth.userId, toolName, args, 'rate_limited', 'Too many requests', Date.now() - startTime);
      return { content: [{ type: 'text', text: '⏳ Limite de requêtes atteinte (30/heure). Réessayez dans quelques minutes.' }] };
    }
  } else {
    // Optional auth for free tools (for logging)
    auth = await authenticateToken(authHeader);
  }

  // 3. Call the Edge Function
  const functionName = TOOL_TO_FUNCTION[toolName];
  if (!functionName) {
    return { content: [{ type: 'text', text: `❌ Outil inconnu : ${toolName}` }] };
  }

  const result = await callEdgeFunction(
    functionName,
    args,
    authHeader || undefined,
  );

  const executionTime = Date.now() - startTime;

  if (result.error) {
    await logMcpUsage(auth?.userId || null, toolName, args, 'error', result.error, executionTime);
    return { content: [{ type: 'text', text: `❌ Erreur lors de l'appel à ${toolName} : ${result.error}` }] };
  }

  await logMcpUsage(auth?.userId || null, toolName, args, 'success', null, executionTime);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result.data, null, 2),
    }],
  };
}

// ── Build MCP Server ────────────────────────────────────

const mcpServer = new McpServer({
  name: "crawlers-fr",
  version: "1.0.0",
});

// --- FREE TIER TOOLS ---

mcpServer.tool({
  name: "check_geo_score",
  description: "Calculate the GEO (Generative Engine Optimization) score for a domain. Returns a 0-100 score measuring how well the site is optimized for AI engines like ChatGPT, Gemini, Perplexity and Claude.",
  inputSchema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Domain to analyze (e.g. example.com)" },
    },
    required: ["domain"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('check_geo_score', args, authHeader);
  },
});

mcpServer.tool({
  name: "check_llm_visibility",
  description: "Check how visible a domain is across major LLMs (ChatGPT, Gemini, Perplexity, Claude, Mistral, Llama). Returns citation rates, mention frequency, and recommendation scores.",
  inputSchema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Domain to check (e.g. example.com)" },
    },
    required: ["domain"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('check_llm_visibility', args, authHeader);
  },
});

mcpServer.tool({
  name: "check_ai_crawlers",
  description: "Analyze which AI bots are crawling a site (GPTBot, ClaudeBot, Google-Extended, Bytespider, etc.). Returns robots.txt analysis, detected bot activity, and blocking recommendations.",
  inputSchema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Domain to analyze (e.g. example.com)" },
    },
    required: ["domain"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('check_ai_crawlers', args, authHeader);
  },
});

// --- PRO AGENCY TOOLS ---

mcpServer.tool({
  name: "expert_seo_audit",
  description: "Run a comprehensive 200-point SEO audit on a URL. Covers technical SEO, on-page optimization, structured data, Core Web Vitals, accessibility, and security.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full URL to audit (e.g. https://example.com/page)" },
    },
    required: ["url"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('expert_seo_audit', args, authHeader);
  },
});

mcpServer.tool({
  name: "strategic_ai_audit",
  description: "Run a strategic AI-powered audit combining SEO signals, GEO readiness, competitive positioning, and content gap analysis.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full URL to audit" },
      sector: { type: "string", description: "Business sector for competitive context (optional)" },
    },
    required: ["url"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('strategic_ai_audit', args, authHeader);
  },
});

mcpServer.tool({
  name: "generate_corrective_code",
  description: "Generate JavaScript corrective code to fix SEO/GEO issues detected by an audit. Returns deployable JS snippets with dry-run capability.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL that was audited" },
      audit_id: { type: "string", description: "ID of a previous audit (optional)" },
    },
    required: ["url"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('generate_corrective_code', args, authHeader);
  },
});

mcpServer.tool({
  name: "dry_run_script",
  description: "Test a corrective script in sandbox mode before deploying. Returns simulated DOM changes and safety assessment.",
  inputSchema: {
    type: "object",
    properties: {
      script_id: { type: "string", description: "ID of the script to test" },
      target_url: { type: "string", description: "URL to simulate the script on" },
    },
    required: ["script_id", "target_url"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('dry_run_script', args, authHeader);
  },
});

mcpServer.tool({
  name: "calculate_cocoon_logic",
  description: "Generate a semantic cocoon structure using TF-IDF analysis. Maps topical clusters, internal linking, and content hierarchy.",
  inputSchema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Domain to analyze" },
      tracked_site_id: { type: "string", description: "Tracked site ID from Crawlers" },
    },
    required: ["domain", "tracked_site_id"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('calculate_cocoon_logic', args, authHeader);
  },
});

mcpServer.tool({
  name: "measure_audit_impact",
  description: "Measure real-world impact of deployed SEO/GEO corrections at T+30, T+60, T+90 days. Correlates audit recommendations with actual traffic changes.",
  inputSchema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Domain to measure" },
      audit_id: { type: "string", description: "ID of the original audit (optional)" },
    },
    required: ["domain"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('measure_audit_impact', args, authHeader);
  },
});

mcpServer.tool({
  name: "wordpress_sync",
  description: "Inject corrective code and SEO fixes directly into a WordPress site via the Crawlers Bridge CMS plugin.",
  inputSchema: {
    type: "object",
    properties: {
      tracked_site_id: { type: "string", description: "Tracked site ID with active CMS connection" },
      script_id: { type: "string", description: "Script to deploy" },
    },
    required: ["tracked_site_id", "script_id"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('wordpress_sync', args, authHeader);
  },
});

mcpServer.tool({
  name: "fetch_serp_kpis",
  description: "Fetch weekly SERP KPIs: keyword rankings, position changes, estimated traffic, visibility score, and competitor comparison.",
  inputSchema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Domain to get KPIs for" },
      tracked_site_id: { type: "string", description: "Tracked site ID" },
    },
    required: ["domain"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('fetch_serp_kpis', args, authHeader);
  },
});

mcpServer.tool({
  name: "calculate_ias",
  description: "Calculate the Strategic Alignment Index (IAS) — a proprietary score measuring content strategy alignment with search intent, AI engine expectations, and competitive positioning.",
  inputSchema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Domain to score" },
      tracked_site_id: { type: "string", description: "Tracked site ID" },
    },
    required: ["domain"],
  },
  handler: async (args: Record<string, unknown>, context?: { request?: Request }) => {
    const authHeader = context?.request?.headers?.get?.('Authorization') || null;
    return handleToolCall('calculate_ias', args, authHeader);
  },
});

// ── HTTP Transport ──────────────────────────────────────

const transport = new StreamableHttpTransport();
const app = new Hono();

// CORS preflight
app.options('/*', (c) => {
  return c.newResponse(null, 204, {
    ...corsHeaders,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  });
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', server: 'crawlers-mcp', version: '1.0.0', tools: Object.keys(TOOL_TO_FUNCTION).length });
});

// MCP protocol endpoint
app.all('/*', async (c) => {
  const response = await transport.handleRequest(c.req.raw, mcpServer);
  // Add CORS headers to all MCP responses
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, {
    status: response.status,
    headers,
  });
});

Deno.serve(app.fetch);
