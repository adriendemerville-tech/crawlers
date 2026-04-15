import { getServiceClient } from '../_shared/supabaseClient.ts';
import { callOpenRouter } from '../_shared/openRouterAI.ts';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { checkDailyCostCap } from '../_shared/dailyCostGuard.ts';
import { CostAccumulator } from '../_shared/llmCostCalculator.ts';

/**
 * Agent UX — Design/UX Agent
 * 
 * Specializes in:
 * 1. Visual bug detection (responsive, contrast, overflow)
 * 2. Conversion optimization (CTA placement, copywriting, layout)
 * 3. Component creation proposals (new sections, banners, cards)
 * 
 * Works within the dry-run → proposal → validation pipeline.
 * Proposals stored in cto_code_proposals with agent_source = 'ux'.
 */

// ─── UX Analysis Categories ─────────────────────────────────────────
const UX_CATEGORIES = [
  { key: 'visual_bugs', label: 'Bugs visuels', desc: 'Responsive cassé, overflow, contrastes insuffisants' },
  { key: 'conversion', label: 'Conversion', desc: 'CTA, copywriting, parcours utilisateur' },
  { key: 'design_system', label: 'Design System', desc: 'Cohérence tokens, typographie, espacement' },
  { key: 'accessibility', label: 'Accessibilité', desc: 'Alt text, focus states, ARIA labels' },
  { key: 'performance_ux', label: 'Performance UX', desc: 'Skeleton loading, lazy images, animations' },
  { key: 'new_component', label: 'Nouveau composant', desc: 'Création de sections, cartes, bannières' },
];

interface UxFinding {
  category: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  file_path: string;
  proposed_fix: string | null;
  confidence: number;
}

interface UxAnalysisResult {
  page: string;
  findings: UxFinding[];
  overall_score: number;
  proposals_count: number;
}

// ─── LLM call ────────────────────────────────────────────────────────
const LLM_MODEL = 'google/gemini-2.5-flash';

async function callLLM(system: string, user: string, costAcc?: CostAccumulator): Promise<string> {
  const resp = await callOpenRouter({
    model: LLM_MODEL,
    system,
    user,
    temperature: 0.2,
    maxTokens: 6000,
    title: 'Crawlers UX Agent',
  });
  trackPaidApiCall('agent-ux', 'openrouter', LLM_MODEL);
  if (costAcc) {
    costAcc.add(LLM_MODEL, resp.usage?.prompt_tokens || 0, resp.usage?.completion_tokens || 0);
  }
  return resp.content;
}

// ─── System prompt ───────────────────────────────────────────────────
function getSystemPrompt(directives: string[]): string {
  const directiveBlock = directives.length > 0
    ? `\n\nDIRECTIVES PRIORITAIRES DU CRÉATEUR :\n${directives.map((d, i) => `${i + 1}. ${d}`).join('\n')}\nCes directives sont prioritaires sur l'analyse automatique.\n`
    : '';

  return `Tu es un Agent UX senior spécialisé en design de SaaS B2B. Tu audites des composants React/Tailwind/shadcn.
  
MISSION : Analyser le code source de pages/composants et produire des propositions de corrections UX/Design.

CATÉGORIES D'ANALYSE :
${UX_CATEGORIES.map(c => `- ${c.key}: ${c.label} — ${c.desc}`).join('\n')}

FORMAT DE RÉPONSE (JSON strict) :
{
  "findings": [
    {
      "category": "visual_bugs|conversion|design_system|accessibility|performance_ux|new_component",
      "severity": "critical|warning|info",
      "title": "Titre court",
      "description": "Description du problème et impact UX",
      "file_path": "src/components/...",
      "proposed_fix": "Code ou description de la correction proposée",
      "confidence": 0-100
    }
  ],
  "overall_score": 0-100,
  "summary": "Résumé en 2-3 phrases"
}

RÈGLES :
- Ne propose que des changements CSS/Tailwind, layout, copywriting, ou création de nouveaux composants
- Ne touche JAMAIS à la logique métier (API calls, state management, routing)
- Utilise les tokens sémantiques du design system (--primary, --secondary, etc.)
- Chaque proposition doit être un patch autonome applicable via le pipeline de code proposals
- Confidence ≥ 85 pour les bugs visuels évidents, ≥ 70 pour les optimisations conversion
- Pour les nouveaux composants : fournis le code complet du composant React/Tailwind
${directiveBlock}`;
}

// ─── Main handler ────────────────────────────────────────────────────
Deno.serve(handleRequest(async (req) => {
  const supabase = getServiceClient();

  // Auth check — admin or service role (dispatcher uses service role key)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Unauthorized', 401);

  const token = authHeader.replace('Bearer ', '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const isServiceRole = token === serviceKey;

  if (!isServiceRole) {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return jsonError('Unauthorized', 401);

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin');
    if (!isAdmin) return jsonError('Forbidden', 403);
  }

  // Cost guard
  const costCheck = await checkDailyCostCap(supabase, 'agent-ux');
  if (!costCheck.allowed) return jsonError('Daily cost cap reached', 429);

  const body = await req.json();
  const { action, target_page, component_code, analysis_type } = body;

  const costAcc = new CostAccumulator();

  // Fetch pending directives
  const { data: pendingDirectives } = await supabase
    .from('agent_ux_directives')
    .select('id, directive_text')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);

  const directiveTexts = (pendingDirectives || []).map((d: any) => d.directive_text);

  if (action === 'analyze') {
    // Analyze a specific page/component
    if (!component_code || !target_page) {
      return jsonError('Missing component_code or target_page', 400);
    }

    const systemPrompt = getSystemPrompt(directiveTexts);
    const userPrompt = `Analyse ce composant React de la page "${target_page}" :\n\n\`\`\`tsx\n${component_code.slice(0, 15000)}\n\`\`\`\n\nType d'analyse demandé : ${analysis_type || 'full'}`;

    const rawResponse = await callLLM(systemPrompt, userPrompt, costAcc);

    // Parse response
    let findings: UxFinding[] = [];
    let overallScore = 0;
    let summary = '';
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        findings = parsed.findings || [];
        overallScore = parsed.overall_score || 0;
        summary = parsed.summary || '';
      }
    } catch (e) {
      console.error('[AGENT-UX] Parse error:', e);
    }

    // Log analysis
    await supabase.from('agent_ux_logs').insert({
      page_analyzed: target_page,
      analysis_type: analysis_type || 'full',
      findings: findings as any,
      proposals_generated: findings.filter(f => f.proposed_fix).length,
      confidence_score: findings.length > 0 ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length : 0,
      model_used: LLM_MODEL,
    });

    // Create proposals for high-confidence findings
    const proposalsToCreate = findings.filter(f => f.proposed_fix && f.confidence >= 70);
    for (const finding of proposalsToCreate) {
      await supabase.from('cto_code_proposals').insert({
        user_id: user.id,
        title: `[UX] ${finding.title}`,
        description: finding.description,
        file_path: finding.file_path,
        original_code: '',
        proposed_code: finding.proposed_fix,
        change_type: finding.category === 'new_component' ? 'create' : 'modify',
        agent_source: 'ux',
        status: 'pending',
        confidence_score: finding.confidence,
      });
    }

    // Mark directives as consumed
    if (pendingDirectives && pendingDirectives.length > 0) {
      for (const d of pendingDirectives) {
        await supabase.from('agent_ux_directives')
          .update({ status: 'consumed', consumed_at: new Date().toISOString() })
          .eq('id', (d as any).id);
      }
    }

    const result: UxAnalysisResult = {
      page: target_page,
      findings,
      overall_score: overallScore,
      proposals_count: proposalsToCreate.length,
    };

    return jsonOk({
      success: true,
      result,
      summary,
      cost: costAcc.getSummary(),
    });
  }

  if (action === 'create_component') {
    // Generate a new component from a directive
    const { directive, page_context } = body;
    if (!directive) return jsonError('Missing directive', 400);

    const systemPrompt = getSystemPrompt(directiveTexts);
    const userPrompt = `DIRECTIVE CRÉATEUR : "${directive}"

Contexte de la page : ${page_context || 'Non spécifié'}

Génère un nouveau composant React/Tailwind/shadcn complet qui répond à cette directive.
Retourne en JSON :
{
  "component_name": "NomDuComposant",
  "file_path": "src/components/NomDuComposant.tsx",
  "code": "// code complet du composant",
  "integration_instructions": "Comment intégrer ce composant dans la page cible",
  "findings": [{ "category": "new_component", "severity": "info", "title": "...", "description": "...", "file_path": "...", "proposed_fix": null, "confidence": 90 }],
  "overall_score": 100,
  "summary": "..."
}`;

    const rawResponse = await callLLM(systemPrompt, userPrompt, costAcc);

    let parsed: any = {};
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('[AGENT-UX] Component parse error:', e);
      return jsonError('Failed to parse component generation', 500);
    }

    // Create proposal
    if (parsed.code) {
      await supabase.from('cto_code_proposals').insert({
        user_id: user.id,
        title: `[UX] Nouveau composant: ${parsed.component_name || 'Component'}`,
        description: parsed.integration_instructions || directive,
        file_path: parsed.file_path || 'src/components/NewComponent.tsx',
        original_code: '',
        proposed_code: parsed.code,
        change_type: 'create',
        agent_source: 'ux',
        status: 'pending',
        confidence_score: 85,
      });
    }

    // Log
    await supabase.from('agent_ux_logs').insert({
      page_analyzed: page_context || 'component_creation',
      analysis_type: 'component_creation',
      findings: parsed.findings || [],
      proposals_generated: parsed.code ? 1 : 0,
      confidence_score: 85,
      model_used: LLM_MODEL,
    });

    return jsonOk({
      success: true,
      component: {
        name: parsed.component_name,
        file_path: parsed.file_path,
        code_preview: (parsed.code || '').slice(0, 500),
        integration: parsed.integration_instructions,
      },
      cost: costAcc.getSummary(),
    });
  }

  return jsonError('Unknown action. Use "analyze" or "create_component".', 400);
}));
