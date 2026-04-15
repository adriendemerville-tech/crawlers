import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { stealthFetch } from '../_shared/stealthFetch.ts';
import { callLovableAI } from '../_shared/lovableAI.ts';
import { getAgentContext } from '../_shared/getAgentContext.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { computeSeoScoreV2, extractTextContent, TOXIC_ANCHORS, type SeoScoreV2, type HeadingHierarchy, type ContentDensity, type LinkProfile, type JsonLdAnalysis, type EEATSignals } from '../_shared/seoScoringV2.ts';

/**
 * Agent SEO Autonome v2
 * 
 * Inspiré des moteurs d'audit expert et stratégique :
 * - StealthFetch pour le scraping anti-détection
 * - Scoring SEO multi-axes réel (heading hierarchy, content density, link profile, JSON-LD, E-E-A-T)
 * - getSiteContext pour l'identité enrichie du site
 * - Lovable AI Gateway au lieu d'OpenRouter
 * - Page type detection (editorial/product/deep/homepage)
 * - Recommandation registry persistence
 */

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') || '';

// ─── Allowed targets ─────────────────────────────────────────────────
const FORBIDDEN_ROUTES = ['/', '/audit-expert', '/app/site-crawl', '/app/audit-compare', '/app/console', '/app/profil'];

const LANDING_PAGES = [
  { slug: 'generative-engine-optimization', url: '/generative-engine-optimization', type: 'landing' as const },
  { slug: 'pro-agency', url: '/pro-agency', type: 'landing' as const },
  { slug: 'tarifs', url: '/tarifs', type: 'landing' as const },
  { slug: 'methodologie', url: '/methodologie', type: 'landing' as const },
  { slug: 'audit-seo-gratuit', url: '/audit-seo-gratuit', type: 'landing' as const },
  { slug: 'analyse-site-web-gratuit', url: '/analyse-site-web-gratuit', type: 'landing' as const },
  { slug: 'indice-alignement-strategique', url: '/indice-alignement-strategique', type: 'landing' as const },
  { slug: 'guide-audit-seo', url: '/guide-audit-seo', type: 'landing' as const },
  { slug: 'faq', url: '/faq', type: 'landing' as const },
  { slug: 'observatoire', url: '/observatoire', type: 'landing' as const },
  { slug: 'integration-gtm', url: '/integration-gtm', type: 'landing' as const },
  { slug: 'lexique', url: '/lexique', type: 'landing' as const },
  { slug: 'aide', url: '/aide', type: 'landing' as const },
];

interface PageTarget {
  slug: string;
  url: string;
  type: 'blog' | 'landing';
}

// ─── Types and scoring imported from _shared/seoScoringV2.ts ────────

// ─── LLM call via Lovable AI Gateway ─────────────────────────────────
async function generateImprovements(
  html: string,
  textContent: string,
  target: PageTarget,
  score: SeoScoreV2,
  siteContext: any,
  operationalContext?: string,
): Promise<{ improvements: string; confidence: number; tokens: { input: number; output: number } }> {
  const prudenceLevel = target.type === 'landing'
    ? `MODE PRUDENT : Max 10% de modification. Micro-optimisations : titres, 1-2 mots-clés, CTA. NE CHANGE PAS la structure.`
    : `MODE LIBRE : Carte blanche pour réécrire, ajouter des sections, enrichir les données, améliorer la structure H2/H3.`;

  // Build context-aware prompt from site identity card (like strategic audit)
  const siteInfo = siteContext
    ? `\nCONTEXTE SITE :\n- Secteur : ${siteContext.market_sector || 'N/A'}\n- Produits/Services : ${siteContext.products_services || 'N/A'}\n- Audience cible : ${siteContext.target_audience || 'N/A'}\n- Zone commerciale : ${siteContext.commercial_area || 'N/A'}\n- Marque : ${siteContext.brand_name || siteContext.site_name || 'N/A'}`
    : '';

  const systemPrompt = `Tu es un Agent SEO expert autonome pour crawlers.fr, plateforme SaaS d'audit SEO et GEO (Generative Engine Optimization).
  
${prudenceLevel}
${siteInfo}

SCORES SEO ACTUELS (7 axes) :
- Score global : ${score.overall}/100
- Profondeur contenu : ${score.axes.content_depth}/100
- Structure Hn : ${score.axes.heading_structure}/100 ${score.headings.gaps.length > 0 ? `(⚠️ ${score.headings.gaps.join(', ')})` : ''}
- Pertinence mots-clés : ${score.axes.keyword_relevance}/100
- Maillage interne : ${score.axes.internal_linking}/100 (${score.linkProfile.crawlersInternalLinks} liens vers pages clés)
- Qualité méta : ${score.axes.meta_quality}/100 (JSON-LD: ${score.jsonLd.count} blocs, types: ${score.jsonLd.types.join(', ') || 'aucun'})
- Signaux E-E-A-T : ${score.axes.eeat_signals}/100
- Densité contenu : ${score.axes.content_density}/100 (ratio text/html: ${(score.contentDensity.ratio * 100).toFixed(1)}%)

PROBLÈMES DÉTECTÉS :
${score.issues.map(i => `- ❌ ${i}`).join('\n') || '- Aucun problème critique'}

OPPORTUNITÉS :
${score.opportunities.map(o => `- 💡 ${o}`).join('\n') || '- Aucune opportunité identifiée'}

OBJECTIFS :
1. Améliorer le score global de +5 à +15 points
2. Corriger les problèmes détectés en priorité
3. Exploiter les opportunités identifiées
4. Renforcer le maillage vers : /audit-expert, /blog, /lexique, /tarifs, /generative-engine-optimization, /cocoon, /aide
5. Ajouter des données chiffrées vérifiables
6. Renforcer les signaux E-E-A-T (auteur, expertise, preuves sociales)
7. Si le JSON-LD est absent ou incomplet, proposer un schema adapté

CONTRAINTES :
- Pas de contenu inventé ou mensonger
- Ton professionnel expert
- Pas de promotionnel excessif
- Rester factuel
${operationalContext ? `\n${operationalContext}\nUtilise ces retours terrain pour prioriser les améliorations les plus impactantes.` : ''}

Réponds UNIQUEMENT en JSON :
{
  "improvements": [
    {
      "type": "content_improvement|meta_optimization|internal_linking|structure_improvement|jsonld_addition|eeat_enhancement",
      "location": "Description précise (ex: H2 'Comprendre le GEO Score', paragraphe après le 2e H3)",
      "before": "Texte original (ou null si ajout)",
      "after": "Texte/code amélioré",
      "impact_axes": ["heading_structure", "keyword_relevance"],
      "reason": "Pourquoi cette modification améliore le SEO"
    }
  ],
  "new_pages": [
    {
      "type": "landing|article",
      "title": "Titre de la nouvelle page",
      "keyword": "mot-clé cible principal",
      "directive": "instruction admin à l'origine (si applicable)"
    }
  ],
  "estimated_score_improvement": 5-15,
  "confidence_score": 0-100,
  "priority_fixes": ["Liste des 3 corrections les plus impactantes"],
  "summary": "Résumé en 2-3 phrases"
}

Note : "new_pages" est OPTIONNEL. N'inclus ce champ QUE si une directive admin le demande explicitement (ex: "crée un article sur...", "ajoute une landing page pour...") ou si un content gap majeur est identifié.`;

  const userPrompt = `PAGE : ${target.type === 'blog' ? 'Article de blog' : 'Landing page'} — ${target.slug}
URL : ${target.url}
Mots : ${score.contentDensity.wordCount} | Liens internes : ${score.linkProfile.internal} | Liens externes : ${score.linkProfile.external}

CONTENU HTML (extrait) :
---
${html.substring(0, 14000)}
---

Analyse et propose des améliorations SEO incrémentales ciblées.`;

  const resp = await callLovableAI({
    system: systemPrompt,
    user: userPrompt,
    tools: [
      {
        type: 'function',
        function: {
          name: 'submit_seo_improvements',
          description: 'Submit SEO improvements for a page',
          parameters: {
            type: 'object',
            properties: {
              improvements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['content_improvement', 'meta_optimization', 'internal_linking', 'structure_improvement', 'jsonld_addition', 'eeat_enhancement'] },
                    location: { type: 'string' },
                    before: { type: 'string' },
                    after: { type: 'string' },
                    impact_axes: { type: 'array', items: { type: 'string' } },
                    reason: { type: 'string' },
                  },
                  required: ['type', 'location', 'after', 'reason'],
                },
              },
              estimated_score_improvement: { type: 'number' },
              confidence_score: { type: 'number' },
              priority_fixes: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' },
              new_pages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['landing', 'article'] },
                    title: { type: 'string' },
                    keyword: { type: 'string' },
                    directive: { type: 'string' },
                  },
                  required: ['type', 'title', 'keyword'],
                },
              },
            },
            required: ['improvements', 'estimated_score_improvement', 'confidence_score', 'summary'],
            additionalProperties: false,
          },
        },
      },
    ],
    toolChoice: { type: 'function', function: { name: 'submit_seo_improvements' } },
  });

  const tokens = {
    input: resp.usage?.prompt_tokens || 0,
    output: resp.usage?.completion_tokens || 0,
  };

  // Parse tool call or fallback
  let content = '';
  let confidence = 0;
  const toolCall = resp.toolCalls?.[0] as any;
  if (toolCall?.function?.arguments) {
    content = toolCall.function.arguments;
    try {
      const parsed = JSON.parse(content);
      confidence = parsed.confidence_score || 0;
    } catch { /* ignore */ }
  } else {
    content = resp.content;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        confidence = parsed.confidence_score || 0;
      }
    } catch { /* ignore */ }
  }

  return { improvements: content, confidence, tokens };
}

// ─── Get blog articles from DB ───────────────────────────────────────
async function getBlogTargets(supabase: any): Promise<PageTarget[]> {
  const { data } = await supabase
    .from('blog_articles')
    .select('slug')
    .eq('status', 'published')
    .limit(50);

  if (!data || data.length === 0) {
    return [
      { slug: 'paradoxe-google-geo-2026', url: '/blog/paradoxe-google-geo-2026', type: 'blog' },
      { slug: 'crawler-definition-seo-geo', url: '/blog/crawler-definition-seo-geo', type: 'blog' },
    ];
  }

  return data.map((a: any) => ({
    slug: a.slug,
    url: `/blog/${a.slug}`,
    type: 'blog' as const,
  }));
}

// ─── Pick next target (round-robin, least recently optimized) ────────
async function pickTarget(supabase: any): Promise<PageTarget | null> {
  const blogTargets = await getBlogTargets(supabase);
  const allTargets = [...blogTargets, ...LANDING_PAGES];

  const { data: recentLogs } = await supabase
    .from('seo_agent_logs')
    .select('page_slug, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const recentSlugs = new Set((recentLogs || []).map((l: any) => l.page_slug));

  // Prioritize never-optimized pages
  const neverOptimized = allTargets.filter(t => !recentSlugs.has(t.slug));
  if (neverOptimized.length > 0) {
    const blogs = neverOptimized.filter(t => t.type === 'blog');
    if (blogs.length > 0) return blogs[Math.floor(Math.random() * blogs.length)];
    return neverOptimized[Math.floor(Math.random() * neverOptimized.length)];
  }

  // Otherwise least recently optimized
  const slugToLastDate: Record<string, string> = {};
  for (const log of (recentLogs || []).reverse()) {
    slugToLastDate[(log as any).page_slug] = (log as any).created_at;
  }
  allTargets.sort((a, b) => {
    const dateA = slugToLastDate[a.slug] || '2000-01-01';
    const dateB = slugToLastDate[b.slug] || '2000-01-01';
    return dateA.localeCompare(dateB);
  });

  return allTargets[0] || null;
}

// ─── Persist recommendations to registry (from strategic audit pattern) ──
async function persistRecommendations(supabase: any, target: PageTarget, score: SeoScoreV2, parsedImprovements: any): Promise<void> {
  try {
    // Clean existing agent-seo recommendations for this page
    await supabase
      .from('audit_recommendations_registry')
      .delete()
      .eq('audit_type', 'agent-seo')
      .ilike('url', `%${target.slug}%`);

    const entries: any[] = [];
    const improvements = parsedImprovements?.improvements || [];

    for (let i = 0; i < improvements.length; i++) {
      const imp = improvements[i];
      const priorityMap: Record<string, string> = {
        'content_improvement': 'important',
        'meta_optimization': 'critical',
        'internal_linking': 'important',
        'structure_improvement': 'critical',
        'jsonld_addition': 'important',
        'eeat_enhancement': 'optional',
      };

      entries.push({
        user_id: '00000000-0000-0000-0000-000000000000', // system user
        domain: 'crawlers.fr',
        url: target.url,
        audit_type: 'agent-seo',
        recommendation_id: `seo_agent_${target.slug}_${i}`,
        title: `[${imp.type}] ${imp.location?.substring(0, 80) || `Amélioration #${i + 1}`}`,
        description: imp.reason || '',
        category: imp.type?.replace('_', ' ') || 'content',
        priority: priorityMap[imp.type] || 'important',
        fix_type: imp.type,
        fix_data: { before: imp.before, after: imp.after, impact_axes: imp.impact_axes },
        prompt_summary: `[SEO Agent] ${imp.reason?.substring(0, 200) || ''}`,
        is_resolved: false,
      });
    }

    if (entries.length > 0) {
      await supabase.from('audit_recommendations_registry').insert(entries);
      console.log(`[AGENT-SEO] ✅ ${entries.length} recommandations persistées dans le registre`);
    }
  } catch (e) {
    console.error('[AGENT-SEO] Erreur persistence registre:', e);
  }
}

// ─── Create code proposals for admin approval ────────────────────────
async function createCodeProposals(supabase: any, target: PageTarget, score: SeoScoreV2, parsedImprovements: any): Promise<number> {
  try {
    const improvements = parsedImprovements?.improvements || [];
    if (improvements.length === 0) return 0;

    const proposals: any[] = [];
    for (const imp of improvements) {
      const diffLines: string[] = [];
      if (imp.before) {
        diffLines.push(`--- AVANT ---`);
        diffLines.push(imp.before);
      }
      diffLines.push(`+++ APRÈS +++`);
      diffLines.push(imp.after || '');

      proposals.push({
        target_function: `page:${target.slug}`,
        target_url: target.url,
        domain: 'crawlers.fr',
        proposal_type: imp.type || 'content_improvement',
        title: `[SEO] ${imp.location?.substring(0, 100) || imp.type || 'Amélioration'}`,
        description: imp.reason || null,
        diff_preview: diffLines.join('\n'),
        original_code: imp.before || null,
        proposed_code: imp.after || null,
        confidence_score: parsedImprovements.confidence_score || 0,
        source_diagnostic_id: `seo_agent_${target.slug}_${Date.now()}`,
        status: 'pending',
        agent_source: 'seo',
      });
    }

    const { error } = await supabase.from('cto_code_proposals').insert(proposals);
    if (error) {
      console.error('[AGENT-SEO] Erreur insertion propositions:', error);
      return 0;
    }

    console.log(`[AGENT-SEO] ✅ ${proposals.length} propositions de code créées (en attente d'approbation)`);
    return proposals.length;
  } catch (e) {
    console.error('[AGENT-SEO] Erreur création propositions:', e);
    return 0;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────
Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const siteBaseUrl = body.base_url || 'https://crawlers.fr';

    // Pick target page
    const targetSlug = body.target_slug || null;
    let target: PageTarget | null = null;

    if (targetSlug) {
      const allTargets = [...(await getBlogTargets(supabase)), ...LANDING_PAGES];
      target = allTargets.find(t => t.slug === targetSlug) || null;
    } else {
      target = await pickTarget(supabase);
    }

    if (!target) {
      return new Response(JSON.stringify({ success: false, error: 'Aucune page cible trouvée' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safety check: forbidden routes
    if (FORBIDDEN_ROUTES.some(r => target!.url === r || target!.url.startsWith(r + '/'))) {
      return new Response(JSON.stringify({ success: false, error: `Route interdite: ${target.url}` }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[AGENT-SEO] 🎯 Cible: ${target.type} — ${target.slug} (${target.url})`);

    // Fetch site identity card + page content + enriched context + admin directives in parallel
    // For blog pages, read content from DB (SPA won't render for server-side fetch)
    const fetchContent = async (): Promise<{ html: string; textContent: string } | null> => {
      if (target!.type === 'blog') {
        const { data: article } = await supabase
          .from('blog_articles')
          .select('content, title, excerpt')
          .eq('slug', target!.slug)
          .single();
        if (article?.content) {
          const textContent = (article.content as string)
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return {
            html: `<h1>${article.title || ''}</h1>${article.content}`,
            textContent: textContent.substring(0, 20000),
          };
        }
      }
      // Fallback: fetch rendered HTML (works for static/landing pages)
      return fetchPageHtml(`${siteBaseUrl}${target!.url}`);
    };

    const [siteContext, pageData, agentContext, directivesResp] = await Promise.all([
      getSiteContext(supabase, { domain: 'crawlers.fr' }).catch(() => null),
      fetchContent(),
      getAgentContext({ agent: 'seo', domain: 'crawlers.fr', days: 7 }).catch(() => null),
      supabase.from('agent_seo_directives')
        .select('id, directive_text, target_url, target_slug')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10)
        .then((r: any) => r)
        .catch(() => ({ data: null })),
    ]);

    if (!pageData || pageData.textContent.length < 100) {
      console.error(`[AGENT-SEO] Contenu insuffisant pour ${target.url}`);
      return new Response(JSON.stringify({ success: false, error: 'Contenu page insuffisant' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (siteContext) {
      console.log(`[AGENT-SEO] 📇 Carte d'identité chargée (confiance: ${siteContext.identity_confidence || 0})`);
    }

    // ── Run audit-expert-seo + check-eeat + strategic-orchestrator in parallel for deep signals ──
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const targetFullUrl = `${siteBaseUrl}${target.url}`;

    let auditExpertData: any = null;
    let eeatData: any = null;
    let strategicData: any = null;

    try {
      const [auditResp, eeatResp, strategicResp] = await Promise.allSettled([
        fetch(`${SUPABASE_URL}/functions/v1/audit-expert-seo`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetFullUrl, domain: 'crawlers.fr' }),
          signal: AbortSignal.timeout(30_000),
        }).then(r => r.ok ? r.json() : null),
        fetch(`${SUPABASE_URL}/functions/v1/check-eeat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetFullUrl, domain: 'crawlers.fr' }),
          signal: AbortSignal.timeout(30_000),
        }).then(r => r.ok ? r.json() : null),
        fetch(`${SUPABASE_URL}/functions/v1/strategic-orchestrator`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetFullUrl, domain: 'crawlers.fr', mode: 'sync' }),
          signal: AbortSignal.timeout(45_000),
        }).then(r => r.ok ? r.json() : null),
      ]);

      if (auditResp.status === 'fulfilled' && auditResp.value) {
        auditExpertData = auditResp.value;
        console.log(`[AGENT-SEO] ✅ audit-expert-seo done for ${target.slug}`);
      } else {
        console.warn(`[AGENT-SEO] ⚠️ audit-expert-seo failed for ${target.slug}`);
      }
      if (eeatResp.status === 'fulfilled' && eeatResp.value) {
        eeatData = eeatResp.value;
        console.log(`[AGENT-SEO] ✅ check-eeat done for ${target.slug}`);
      } else {
        console.warn(`[AGENT-SEO] ⚠️ check-eeat failed for ${target.slug}`);
      }
      if (strategicResp.status === 'fulfilled' && strategicResp.value) {
        strategicData = strategicResp.value;
        console.log(`[AGENT-SEO] ✅ strategic-orchestrator done for ${target.slug}`);
      } else {
        console.warn(`[AGENT-SEO] ⚠️ strategic-orchestrator failed for ${target.slug}`);
      }
    } catch (e) {
      console.warn('[AGENT-SEO] Audit enrichment failed (non-blocking):', e);
    }

    // Compute multi-axes SEO score
    const scoreBefore = computeSeoScoreV2(pageData.html, pageData.textContent, target.type);
    // Enrich score with audit data
    if (auditExpertData?.data) {
      (scoreBefore as any).auditExpert = {
        recommendations: auditExpertData.data.recommendations?.slice(0, 10),
        overallScore: auditExpertData.data.overallScore,
      };
    }
    if (eeatData?.data) {
      (scoreBefore as any).eeatAudit = {
        scores: eeatData.data.scores,
        summary: eeatData.data.summary,
      };
    }
    console.log(`[AGENT-SEO] Score avant: ${scoreBefore.overall}/100 | Axes: content=${scoreBefore.axes.content_depth} heading=${scoreBefore.axes.heading_structure} kw=${scoreBefore.axes.keyword_relevance} links=${scoreBefore.axes.internal_linking} meta=${scoreBefore.axes.meta_quality} eeat=${scoreBefore.axes.eeat_signals}${auditExpertData ? ' +audit' : ''}${eeatData ? ' +eeat' : ''}${strategicData ? ' +strategic' : ''}`);

    // Build admin directives context
    const pendingDirectives = directivesResp?.data || [];
    let directivesContext = '';
    // Filter directives relevant to this target (or global)
    const relevantDirectives = pendingDirectives.filter((d: any) =>
      !d.target_slug || d.target_slug === target.slug || (d.target_url && target.url.includes(d.target_url))
    );
    if (relevantDirectives.length > 0) {
      directivesContext = `\n\nDIRECTIVES ADMIN (instructions prioritaires du créateur) :\n${relevantDirectives.map((d: any, i: number) => `${i + 1}. ${d.directive_text}${d.target_url ? ` [cible: ${d.target_url}]` : ''}`).join('\n')}\n\nCes directives sont PRIORITAIRES. Intègre-les dans tes améliorations.`;
      console.log(`[AGENT-SEO] 📋 ${relevantDirectives.length} directive(s) admin chargées`);
    }

    // Build audit enrichment context for LLM
    let auditEnrichment = '';
    if (auditExpertData?.data?.recommendations?.length > 0) {
      const topRecos = auditExpertData.data.recommendations.slice(0, 8);
      auditEnrichment += `\n\nAUDIT EXPERT SEO (${topRecos.length} recommandations prioritaires) :\n${topRecos.map((r: any, i: number) => `${i + 1}. [${r.priority || 'medium'}] ${r.title}: ${(r.description || '').substring(0, 120)}`).join('\n')}`;
    }
    if (eeatData?.data) {
      const e = eeatData.data;
      auditEnrichment += `\n\nAUDIT E-E-A-T :\n- Score global: ${e.scores?.overall || 'N/A'}/100\n- Expérience: ${e.scores?.experience || 'N/A'} | Expertise: ${e.scores?.expertise || 'N/A'} | Autorité: ${e.scores?.authoritativeness || 'N/A'} | Fiabilité: ${e.scores?.trustworthiness || 'N/A'}\n- Résumé: ${(e.summary || '').substring(0, 200)}`;
    }
    if (strategicData?.data) {
      const s = strategicData.data;
      const quickWins = s.quick_wins?.slice(0, 5) || [];
      const gaps = s.content_gaps?.slice(0, 5) || [];
      auditEnrichment += `\n\nAUDIT STRATÉGIQUE GEO :`;
      if (quickWins.length > 0) {
        auditEnrichment += `\n- Quick wins: ${quickWins.map((q: any) => `"${q.keyword}" (vol: ${q.search_volume || '?'}, pos: ${q.position || '?'})`).join(', ')}`;
      }
      if (gaps.length > 0) {
        auditEnrichment += `\n- Gaps de contenu: ${gaps.map((g: any) => `"${g.keyword || g.topic}" (${g.reason || 'manquant'})`).join(', ')}`;
      }
      if (s.competitors?.length > 0) {
        auditEnrichment += `\n- Concurrents SERP: ${s.competitors.slice(0, 3).map((c: any) => c.domain || c).join(', ')}`;
      }
    }

    // Generate improvements via Lovable AI (context-enriched with SAV + anomalies + admin directives + audits)
    const operationalCtx = [agentContext?.promptSnippet, directivesContext, auditEnrichment].filter(Boolean).join('\n');
    const { improvements, confidence, tokens } = await generateImprovements(
      pageData.html, pageData.textContent, target, scoreBefore, siteContext,
      operationalCtx || undefined,
    );

    // Mark consumed directives (relevant ones + any in_progress to prevent stale state)
    if (relevantDirectives.length > 0) {
      const directiveIds = relevantDirectives.map((d: any) => d.id);
      await supabase.from('agent_seo_directives')
        .update({ status: 'consumed', consumed_at: new Date().toISOString() })
        .in('id', directiveIds)
        .then(() => console.log(`[AGENT-SEO] ✅ ${directiveIds.length} directive(s) marquées comme consommées`))
        .catch((e: any) => console.error('[AGENT-SEO] Erreur mise à jour directives:', e));
    }
    // Also mark any in_progress directives as consumed (prevent stale state from dispatcher)
    await supabase.from('agent_seo_directives')
      .update({ status: 'consumed', consumed_at: new Date().toISOString() })
      .eq('status', 'in_progress')
      .then(() => {})
      .catch(() => {});

    // Parse improvements
    let parsedImprovements: any = null;
    let summary = 'Améliorations générées';
    try {
      const jsonMatch = improvements.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedImprovements = JSON.parse(jsonMatch[0]);
        summary = parsedImprovements.summary || summary;
      }
    } catch (e) {
      console.error('[AGENT-SEO] Parse error:', e);
    }

    const estimatedScoreAfter = Math.min(100, scoreBefore.overall + (parsedImprovements?.estimated_score_improvement || 5));

    // Persist recommendations to registry + create code proposals for admin approval
    let proposalsCreated = 0;
    if (parsedImprovements?.improvements?.length > 0) {
      await persistRecommendations(supabase, target, scoreBefore, parsedImprovements);
      proposalsCreated = await createCodeProposals(supabase, target, scoreBefore, parsedImprovements);
    }

    // ── Page creation drafts (from directives or content gaps) ──
    let pageDraftsCreated = 0;
    if (parsedImprovements?.new_pages?.length > 0) {
      try {
        for (const newPage of parsedImprovements.new_pages) {
          const pageType = newPage.type || 'article';
          // Fetch template for this page type
          const { data: template } = await supabase
            .from('content_prompt_templates')
            .select('id, structure_template, seo_rules, geo_rules, tone_guidelines, system_prompt')
            .eq('page_type', pageType)
            .eq('is_active', true)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!template) {
            console.warn(`[AGENT-SEO] Pas de template actif pour type="${pageType}", skip`);
            continue;
          }

          // Generate page content using template
          const pagePrompt = `${template.system_prompt}\n\n## Structure attendue\n${template.structure_template}\n\n## Règles SEO\n${template.seo_rules}\n\n## Règles GEO\n${template.geo_rules}\n\n## Ton éditorial\n${template.tone_guidelines}\n\n## Instructions\nCrée une page complète de type "${pageType}" sur le sujet: "${newPage.title || newPage.keyword}"\nMot-clé cible: ${newPage.keyword || newPage.title}\nDate du jour: ${new Date().toISOString().split('T')[0]}\n\nRéponds en JSON avec: { "title", "slug", "meta_title", "meta_description", "content" (markdown complet) }`;

          const pageResp = await callLovableAI({
            messages: [{ role: 'user', content: pagePrompt }],
            model: 'google/gemini-2.5-flash',
            temperature: 0.7,
            max_tokens: 8000,
          });

          const pageContent = pageResp?.content || '';
          let pageParsed: any = null;
          try {
            const jsonMatch = pageContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) pageParsed = JSON.parse(jsonMatch[0]);
          } catch { /* ignore */ }

          if (pageParsed?.title && pageParsed?.content) {
            await supabase.from('seo_page_drafts').insert({
              user_id: '00000000-0000-0000-0000-000000000000',
              page_type: pageType,
              template_id: template.id,
              domain: 'crawlers.fr',
              target_keyword: newPage.keyword || newPage.title,
              title: pageParsed.title,
              slug: pageParsed.slug || pageParsed.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
              meta_title: pageParsed.meta_title || pageParsed.title,
              meta_description: pageParsed.meta_description || '',
              content: pageParsed.content,
              generation_context: {
                source: 'agent-seo',
                template_id: template.id,
                keyword: newPage.keyword,
                directive: newPage.directive || null,
                score_context: { overall: scoreBefore.overall },
              },
              status: 'draft',
            });
            pageDraftsCreated++;
            console.log(`[AGENT-SEO] 📄 Brouillon créé: "${pageParsed.title}" (${pageType})`);
          }
        }
      } catch (e) {
        console.error('[AGENT-SEO] Erreur création brouillons:', e);
      }
    }

    // Log to database with full scoring detail
    const logEntry = {
      page_type: target.type,
      page_slug: target.slug,
      page_url: target.url,
      action_type: 'content_improvement',
      changes_summary: summary,
      changes_detail: {
        ...(parsedImprovements || { raw: improvements.substring(0, 5000) }),
        score_axes: scoreBefore.axes,
        issues: scoreBefore.issues,
        opportunities: scoreBefore.opportunities,
        headings: scoreBefore.headings,
        linkProfile: { internal: scoreBefore.linkProfile.internal, external: scoreBefore.linkProfile.external, toxic: scoreBefore.linkProfile.toxicAnchorsCount, crawlersLinks: scoreBefore.linkProfile.crawlersInternalLinks },
        jsonLd: scoreBefore.jsonLd,
        eeat: scoreBefore.eeat,
      },
      seo_score_before: scoreBefore.overall,
      seo_score_after: estimatedScoreAfter,
      confidence_score: confidence,
      status: 'pending_review',
      model_used: 'google/gemini-2.5-flash',
      tokens_used: tokens,
    };

    const { error: logError } = await supabase.from('seo_agent_logs').insert(logEntry);
    if (logError) console.error('[AGENT-SEO] Log error:', logError);

    await trackTokenUsage('agent-seo', 'google/gemini-2.5-flash', { prompt_tokens: tokens.input, completion_tokens: tokens.output, total_tokens: tokens.input + tokens.output }).catch(() => {});

    console.log(`[AGENT-SEO] ✅ ${target.slug} — score ${scoreBefore.overall} → ${estimatedScoreAfter} (confiance: ${confidence}%) | ${parsedImprovements?.improvements?.length || 0} améliorations | ${scoreBefore.issues.length} problèmes`);

    return new Response(JSON.stringify({
      success: true,
      target: { slug: target.slug, url: target.url, type: target.type },
      score_before: scoreBefore.overall,
      score_after: estimatedScoreAfter,
      score_axes: scoreBefore.axes,
      issues_count: scoreBefore.issues.length,
      opportunities_count: scoreBefore.opportunities.length,
      confidence,
      summary,
      improvements_count: parsedImprovements?.improvements?.length || 0,
      proposals_created: proposalsCreated,
      page_drafts_created: pageDraftsCreated,
      priority_fixes: parsedImprovements?.priority_fixes || [],
      status: logEntry.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AGENT-SEO] Erreur:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, 'agent-seo'))
