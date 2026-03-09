import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface AgentAnalysis {
  analysis_summary: string;
  self_critique: string;
  confidence_score: number;
  proposed_change: string | null;
  change_diff_pct: number;
  decision: 'approved' | 'rejected' | 'needs_review';
}

async function isAgentEnabled(): Promise<boolean> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'cto_agent_enabled')
    .single();
  return data?.value?.enabled === true;
}

async function getChampionPrompt(supabase: any, functionName: string, promptKey = 'system'): Promise<{ version: number; prompt_text: string } | null> {
  const { data } = await supabase
    .from('prompt_registry')
    .select('version, prompt_text')
    .eq('function_name', functionName)
    .eq('prompt_key', promptKey)
    .eq('is_champion', true)
    .single();
  return data;
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<{ content: string; tokens: { input: number; output: number } }> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://crawlers.fr',
      'X-Title': 'Crawlers CTO Agent',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const tokens = {
    input: data.usage?.prompt_tokens || 0,
    output: data.usage?.completion_tokens || 0,
  };
  trackPaidApiCall('agent-cto', 'openrouter', 'anthropic/claude-3.5-sonnet');
  return { content, tokens };
}

function parseAgentResponse(raw: string): AgentAnalysis {
  try {
    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        analysis_summary: parsed.analysis_summary || 'No summary',
        self_critique: parsed.self_critique || 'No critique',
        confidence_score: Math.min(100, Math.max(0, Number(parsed.confidence_score) || 0)),
        proposed_change: parsed.proposed_change || null,
        change_diff_pct: Math.min(100, Math.max(0, Number(parsed.change_diff_pct) || 0)),
        decision: parsed.confidence_score >= 95 && parsed.change_diff_pct <= 10 ? 'approved' : 'rejected',
      };
    }
  } catch (e) {
    console.error('[AGENT-CTO] Parse error:', e);
  }
  return {
    analysis_summary: 'Failed to parse response',
    self_critique: raw.substring(0, 500),
    confidence_score: 0,
    proposed_change: null,
    change_diff_pct: 0,
    decision: 'rejected',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if agent is enabled
    const enabled = await isAgentEnabled();
    if (!enabled) {
      return new Response(JSON.stringify({ success: false, reason: 'Agent CTO désactivé' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { auditResult, auditType, url, domain } = await req.json();

    if (!auditResult || !auditType) {
      return new Response(JSON.stringify({ success: false, error: 'Missing auditResult or auditType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const functionName = auditType === 'technical' ? 'audit-expert-seo' : 'audit-strategique-ia';

    // Get current champion prompt (if exists)
    const champion = await getChampionPrompt(supabase, functionName);
    const currentVersion = champion?.version || 0;
    const currentPrompt = champion?.prompt_text || 'Aucun prompt enregistré — première analyse.';

    // Truncate audit data to stay within context limits
    const auditSummary = JSON.stringify(auditResult).substring(0, 8000);

    const systemPrompt = `Tu es un Agent CTO senior spécialisé en SEO technique et GEO (Generative Engine Optimization).
Ton rôle : analyser la pertinence d'un audit SEO produit par une de nos fonctions backend et proposer des micro-améliorations au prompt système qui pilote cette fonction.

RÈGLES STRICTES :
1. RÈGLE DES 10% : Tu ne peux modifier que 10% maximum du prompt existant. Micro-réglages uniquement.
2. SEUIL DE CONFIANCE : Tu ne proposes un changement que si tu es sûr à 95% minimum qu'il n'aura aucun effet négatif.
3. APPROCHE PARTIELLE : Préfère une petite amélioration stable à une refonte risquée.
4. AUTO-CRITIQUE : Tu dois critiquer ta propre proposition avant de la valider.

Réponds UNIQUEMENT en JSON valide avec cette structure :
{
  "analysis_summary": "Résumé de l'analyse de pertinence de l'audit",
  "self_critique": "Critique de ta propre proposition — risques identifiés",
  "confidence_score": 0-100,
  "proposed_change": "Le nouveau prompt modifié (null si aucun changement proposé)",
  "change_diff_pct": 0-100
}`;

    const userPrompt = `FONCTION ANALYSÉE : ${functionName}
TYPE D'AUDIT : ${auditType}
URL AUDITÉE : ${url || 'N/A'}
DOMAINE : ${domain || 'N/A'}

PROMPT ACTUEL (v${currentVersion}) :
---
${currentPrompt}
---

RÉSULTAT DE L'AUDIT (tronqué) :
---
${auditSummary}
---

Analyse la pertinence de cet audit. Le score est-il cohérent ? Les recommandations sont-elles actionnables ? Le prompt pourrait-il être micro-amélioré pour de meilleurs résultats futurs ?`;

    console.log(`[AGENT-CTO] Analyse de ${functionName} pour ${domain}...`);

    const { content, tokens } = await callClaude(systemPrompt, userPrompt);

    // Track token usage
    trackTokenUsage('agent-cto', 'anthropic/claude-3.5-sonnet', tokens.input, tokens.output).catch(() => {});

    const analysis = parseAgentResponse(content);

    console.log(`[AGENT-CTO] Décision: ${analysis.decision} (confiance: ${analysis.confidence_score}%, diff: ${analysis.change_diff_pct}%)`);

    // Log the analysis
    const logEntry: any = {
      audit_id: `${domain}_${Date.now()}`,
      function_analyzed: functionName,
      analysis_summary: analysis.analysis_summary,
      self_critique: analysis.self_critique,
      confidence_score: analysis.confidence_score,
      proposed_change: analysis.proposed_change,
      change_diff_pct: analysis.change_diff_pct,
      decision: analysis.decision,
      prompt_version_before: currentVersion,
      metadata: { url, domain, auditType, tokens },
    };

    // If approved: create new champion prompt
    if (analysis.decision === 'approved' && analysis.proposed_change) {
      const newVersion = currentVersion + 1;

      // Demote old champion
      if (champion) {
        await supabase
          .from('prompt_registry')
          .update({ is_champion: false })
          .eq('function_name', functionName)
          .eq('prompt_key', 'system')
          .eq('is_champion', true);
      }

      // Insert new champion
      const { error: insertError } = await supabase
        .from('prompt_registry')
        .insert({
          function_name: functionName,
          prompt_key: 'system',
          version: newVersion,
          prompt_text: analysis.proposed_change,
          is_champion: true,
          created_by: 'agent-cto',
          metadata: {
            confidence_score: analysis.confidence_score,
            change_diff_pct: analysis.change_diff_pct,
            self_critique: analysis.self_critique,
          },
        });

      if (insertError) {
        console.error('[AGENT-CTO] Erreur insertion prompt:', insertError);
        logEntry.decision = 'rejected';
        logEntry.metadata.insert_error = insertError.message;
      } else {
        logEntry.prompt_version_after = newVersion;
        console.log(`[AGENT-CTO] ✅ Nouveau prompt champion v${newVersion} pour ${functionName}`);
      }
    }

    // Save log
    const { error: logError } = await supabase.from('cto_agent_logs').insert(logEntry);
    if (logError) console.error('[AGENT-CTO] Erreur log:', logError);

    return new Response(JSON.stringify({
      success: true,
      decision: analysis.decision,
      confidence: analysis.confidence_score,
      version: logEntry.prompt_version_after || currentVersion,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AGENT-CTO] Erreur:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
