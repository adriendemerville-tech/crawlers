/**
 * crossAgentContext.ts — Cross-agent communication layer
 * 
 * Provides context sharing between Félix (SAV) and Stratège (Cocoon):
 * 1. Félix reads cocoon diagnostics to enrich SEO answers
 * 2. Stratège reads SAV conversation patterns to prioritize topics
 * 3. Handoff context passing between agents
 * 4. Feedback loop detection (unresolved recommendations)
 */

import { getServiceClient } from './supabaseClient.ts';

// ═══════════════════════════════════════════════
// 1. FÉLIX → reads Cocoon diagnostics for a site
// ═══════════════════════════════════════════════

export interface CocoonInsight {
  diagnostic_type: string;
  top_findings: string[];
  scores: Record<string, number>;
  created_at: string;
}

export async function getCocoonDiagnosticsForFelix(
  trackedSiteId: string,
): Promise<{ snippet: string; insights: CocoonInsight[] }> {
  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(); // last 7 days

  const { data: diags } = await sb
    .from('cocoon_diagnostic_results')
    .select('diagnostic_type, findings, scores, created_at')
    .eq('tracked_site_id', trackedSiteId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(4);

  if (!diags?.length) return { snippet: '', insights: [] };

  const insights: CocoonInsight[] = diags.map((d: any) => {
    const findings = Array.isArray(d.findings) ? d.findings : [];
    return {
      diagnostic_type: d.diagnostic_type,
      top_findings: findings
        .slice(0, 3)
        .map((f: any) => f.title || f.description || f.issue || JSON.stringify(f).slice(0, 80)),
      scores: d.scores || {},
      created_at: d.created_at,
    };
  });

  // Also fetch latest strategy plan if exists
  const { data: stratPlan } = await sb
    .from('cocoon_strategy_plans')
    .select('plan_data, created_at')
    .eq('tracked_site_id', trackedSiteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let snippet = '\n\n# DIAGNOSTICS COCOON (Stratège) — déjà réalisés\n';
  snippet += 'Le Stratège Cocoon a déjà analysé ce site. Voici les résultats disponibles :\n';
  
  for (const ins of insights) {
    const scoreStr = Object.entries(ins.scores)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    snippet += `\n## Diagnostic ${ins.diagnostic_type} (${ins.created_at.slice(0, 10)})\n`;
    if (scoreStr) snippet += `Scores: ${scoreStr}\n`;
    if (ins.top_findings.length) {
      snippet += `Principaux constats :\n`;
      for (const f of ins.top_findings) {
        snippet += `- ${f}\n`;
      }
    }
  }

  if (stratPlan?.plan_data) {
    const plan = stratPlan.plan_data as any;
    const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
    if (tasks.length > 0) {
      snippet += `\n## Plan stratégique en cours (${stratPlan.created_at.slice(0, 10)})\n`;
      snippet += `${tasks.length} tâches prescrites :\n`;
      for (const t of tasks.slice(0, 5)) {
        snippet += `- [${t.priority || '?'}] ${t.title || t.action_label || 'Tâche'}\n`;
      }
    }
  }

  snippet += `\nSi l'utilisateur pose une question couverte par ces diagnostics, utilise ces données plutôt que de lui demander de refaire un diagnostic.\n`;
  snippet += `Si la question nécessite une analyse plus approfondie, propose : "Le Stratège Cocoon a déjà travaillé sur ton site. Veux-tu que je te transfère avec le contexte ?"\n`;

  return { snippet, insights };
}

// ═══════════════════════════════════════════════
// 2. STRATÈGE → reads SAV conversation patterns
// ═══════════════════════════════════════════════

export interface SavPattern {
  topic: string;
  count: number;
  sample_messages: string[];
}

export async function getSavPatternsForStrategist(
  userId: string,
  domain: string,
): Promise<{ snippet: string; patterns: SavPattern[] }> {
  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(); // last 30 days

  const { data: convs } = await sb
    .from('sav_conversations')
    .select('messages, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!convs?.length) return { snippet: '', patterns: [] };

  // Extract user messages and detect repeated topics
  const topicCounts: Record<string, { count: number; samples: string[] }> = {};
  const seoTopics: Record<string, string[]> = {
    maillage: ['maillage', 'liens internes', 'internal link', 'linking', 'orpheline', 'orphan'],
    contenu: ['contenu', 'content', 'texte', 'rédaction', 'article', 'thin', 'mince'],
    performance: ['performance', 'vitesse', 'speed', 'pagespeed', 'lcp', 'fcp', 'cls'],
    seo_technique: ['canonical', 'robots', 'sitemap', 'redirect', '404', 'indexation', 'crawl'],
    geo_visibilite: ['geo', 'llm', 'chatgpt', 'perplexity', 'gemini', 'citation', 'visibilité ia'],
    eeat: ['eeat', 'e-e-a-t', 'autorité', 'expertise', 'confiance', 'trust'],
    structured_data: ['schema', 'json-ld', 'données structurées', 'structured data', 'rich snippet'],
    backlinks: ['backlink', 'netlinking', 'domaine référent', 'referring domain'],
    cannibalization: ['cannibalisation', 'cannibalization', 'duplicate', 'doublon'],
  };

  for (const conv of convs) {
    const msgs = Array.isArray(conv.messages) ? conv.messages : [];
    const userMsgs = msgs.filter((m: any) => m.role === 'user').map((m: any) => (m.content || '').toLowerCase());

    for (const msg of userMsgs) {
      // Also check if domain is mentioned
      const mentionsDomain = msg.includes(domain.toLowerCase().replace(/^www\./, ''));

      for (const [topic, keywords] of Object.entries(seoTopics)) {
        if (keywords.some(kw => msg.includes(kw))) {
          if (!topicCounts[topic]) topicCounts[topic] = { count: 0, samples: [] };
          topicCounts[topic].count++;
          if (topicCounts[topic].samples.length < 2) {
            topicCounts[topic].samples.push(msg.slice(0, 100));
          }
        }
      }
    }
  }

  // Sort by frequency
  const patterns: SavPattern[] = Object.entries(topicCounts)
    .filter(([_, v]) => v.count >= 2) // Only repeated topics
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([topic, data]) => ({
      topic,
      count: data.count,
      sample_messages: data.samples,
    }));

  if (patterns.length === 0) return { snippet: '', patterns: [] };

  let snippet = '\n\n# PATTERNS SAV (Félix) — Questions récurrentes de l\'utilisateur\n';
  snippet += 'L\'utilisateur a posé ces questions de manière récurrente dans le chat SAV :\n';
  
  for (const p of patterns) {
    snippet += `\n- **${p.topic}** : mentionné ${p.count} fois dans les 30 derniers jours\n`;
    for (const s of p.sample_messages) {
      snippet += `  > "${s}"\n`;
    }
  }

  snippet += `\n→ INSTRUCTION : Priorise les diagnostics et recommandations liés à ces sujets récurrents. L'utilisateur y attache de l'importance.\n`;

  return { snippet, patterns };
}

// ═══════════════════════════════════════════════
// 3. HANDOFF: pass context from Félix to Stratège
// ═══════════════════════════════════════════════

export async function createHandoffContext(
  userId: string,
  trackedSiteId: string,
  domain: string,
  conversationSummary: string,
  detectedTopics: string[],
): Promise<string> {
  const sb = getServiceClient();

  // Store handoff insight
  await sb.from('cross_agent_insights').insert({
    tracked_site_id: trackedSiteId,
    user_id: userId,
    insight_type: 'handoff',
    source_agent: 'felix',
    target_agent: 'stratege',
    insight_data: {
      summary: conversationSummary,
      topics: detectedTopics,
      timestamp: new Date().toISOString(),
    },
  });

  return `handoff_${trackedSiteId}_${Date.now()}`;
}

// ═══════════════════════════════════════════════
// 4. FEEDBACK LOOP: detect unresolved recommendations
// ═══════════════════════════════════════════════

export async function detectFeedbackLoop(
  userId: string,
  trackedSiteId: string,
  domain: string,
  currentMessage: string,
): Promise<string> {
  const sb = getServiceClient();

  // Check if there are strategy plans with tasks for this site
  const { data: stratPlan } = await sb
    .from('cocoon_strategy_plans')
    .select('plan_data, created_at')
    .eq('tracked_site_id', trackedSiteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!stratPlan?.plan_data) return '';

  const plan = stratPlan.plan_data as any;
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const planAge = Date.now() - new Date(stratPlan.created_at).getTime();
  const planAgeDays = Math.floor(planAge / (24 * 3600 * 1000));

  // Only trigger if plan is older than 7 days
  if (planAgeDays < 7) return '';

  // Check if current message relates to a topic covered by the strategy plan
  const msgLower = currentMessage.toLowerCase();
  const matchingTasks = tasks.filter((t: any) => {
    const taskText = `${t.title || ''} ${t.action_label || ''} ${t.description || ''}`.toLowerCase();
    // Simple keyword overlap
    const taskWords = taskText.split(/\s+/).filter((w: string) => w.length > 4);
    const msgWords = msgLower.split(/\s+/).filter((w: string) => w.length > 4);
    const overlap = taskWords.filter((w: string) => msgWords.includes(w));
    return overlap.length >= 2;
  });

  if (matchingTasks.length === 0) return '';

  // Store feedback loop insight
  await sb.from('cross_agent_insights').insert({
    tracked_site_id: trackedSiteId,
    user_id: userId,
    insight_type: 'unresolved_recommendation',
    source_agent: 'felix',
    target_agent: 'stratege',
    insight_data: {
      plan_date: stratPlan.created_at,
      plan_age_days: planAgeDays,
      matching_tasks: matchingTasks.slice(0, 3).map((t: any) => t.title || t.action_label),
      user_message: currentMessage.slice(0, 200),
    },
  });

  return `\n⚠️ BOUCLE DE FEEDBACK DÉTECTÉE : Le Stratège Cocoon a recommandé des actions il y a ${planAgeDays} jours sur ce sujet (${matchingTasks.map((t: any) => t.title || t.action_label).join(', ')}), mais l'utilisateur revient avec la même question. Mentionne que des recommandations existent déjà et propose de les revoir : "Le Stratège Cocoon avait déjà identifié ce point il y a ${planAgeDays} jours. Veux-tu qu'on revoit les recommandations ensemble ?"`;
}

// ═══════════════════════════════════════════════
// 5. ADMIN: Cross-agent insights aggregation
// ═══════════════════════════════════════════════

export async function getCrossAgentReport(): Promise<{
  unresolved_count: number;
  handoff_count: number;
  top_recurring_topics: Array<{ topic: string; count: number }>;
  recent_insights: any[];
}> {
  const sb = getServiceClient();

  const [unresolvedResp, handoffResp, recentResp] = await Promise.all([
    sb.from('cross_agent_insights')
      .select('id', { count: 'exact' })
      .eq('insight_type', 'unresolved_recommendation')
      .eq('is_resolved', false),
    sb.from('cross_agent_insights')
      .select('id', { count: 'exact' })
      .eq('insight_type', 'handoff'),
    sb.from('cross_agent_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // Aggregate recurring topics from insights
  const topicCounts: Record<string, number> = {};
  for (const ins of (recentResp.data || [])) {
    const data = ins.insight_data as any;
    if (data?.topics) {
      for (const t of data.topics) {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      }
    }
    if (data?.matching_tasks) {
      for (const t of data.matching_tasks) {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      }
    }
  }

  const top_recurring_topics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  return {
    unresolved_count: unresolvedResp.count || 0,
    handoff_count: handoffResp.count || 0,
    top_recurring_topics,
    recent_insights: (recentResp.data || []).slice(0, 10),
  };
}
