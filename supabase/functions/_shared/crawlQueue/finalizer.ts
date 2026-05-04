/**
 * Job finalizer — post-crawl analysis: BFS depth, duplicates, AI summary, keyword universe.
 */
import type { PageAnalysis } from './types.ts';
import { detectDuplicates, computeBFSDepths } from './duplicateDetector.ts';
import { saveRawAuditData } from '../saveRawAuditData.ts';
import { classifyAndAssignRings } from '../spiralClassifier.ts';
import { classifyPageIntent, aggregateIntents } from '../pageIntent.ts';

export async function finalizeJob(
  supabase: any,
  job: any,
  _firecrawlKey: string,
  failedUrls: Array<{ url: string; reason: string }> = [],
) {
  console.log(`[Worker] Finalizing job ${job.id}...`);

  await supabase.from('crawl_jobs').update({ status: 'analyzing' }).eq('id', job.id);
  await supabase.from('site_crawls').update({ status: 'analyzing' }).eq('id', job.crawl_id);

  const { data: allPages } = await supabase
    .from('crawl_pages')
    .select('*')
    .eq('crawl_id', job.crawl_id);

  const pages = allPages || [];

  // ── BFS Depth Recalculation (real link graph) ──
  if (pages.length > 1) {
    const bfsDepths = computeBFSDepths(pages as PageAnalysis[], job.url);
    const normalize = (u: string) => {
      try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; }
    };
    for (const page of pages) {
      const path = normalize(page.url);
      const newDepth = bfsDepths.get(path) ?? page.crawl_depth ?? 0;
      if (newDepth !== page.crawl_depth) {
        await supabase.from('crawl_pages').update({ crawl_depth: newDepth }).eq('id', page.id);
        page.crawl_depth = newDepth;
      }
    }
    console.log(`[Worker] BFS depth recalculated for ${pages.length} pages`);
  }

  const avgScore = pages.length > 0
    ? Math.round(pages.reduce((s: number, p: any) => s + (p.seo_score || 0), 0) / pages.length)
    : 0;

  // ── Cross-page duplicate detection ──
  const duplicateIssues = detectDuplicates(pages as PageAnalysis[]);
  if (Object.keys(duplicateIssues).length > 0) {
    console.log(`[Worker] Found duplicates on ${Object.keys(duplicateIssues).length} pages`);
    for (const [url, newIssues] of Object.entries(duplicateIssues)) {
      const page = pages.find((p: any) => p.url === url);
      if (page) {
        const existingIssues = (page.issues as string[]) || [];
        const mergedIssues = [...new Set([...existingIssues, ...newIssues])];
        await supabase.from('crawl_pages').update({ issues: mergedIssues }).eq('id', page.id);
      }
    }
  }

  // ── AI Summary ──
  let aiSummary = '';
  let aiRecommendations: any[] = [];

  const aiResult = await generateAISummary(pages, job, avgScore, duplicateIssues, failedUrls);
  aiSummary = aiResult.summary;
  aiRecommendations = aiResult.recommendations;

  await supabase.from('site_crawls').update({
    status: 'completed',
    crawled_pages: pages.length,
    avg_score: avgScore,
    ai_summary: aiSummary,
    ai_recommendations: aiRecommendations,
    completed_at: new Date().toISOString(),
  }).eq('id', job.crawl_id);

  // Save raw crawl data (fire-and-forget)
  saveRawAuditData({
    userId: job.user_id,
    url: job.url,
    domain: job.domain,
    auditType: 'crawl',
    rawPayload: {
      pages: pages.map((p: any) => ({
        url: p.url, path: p.path, title: p.title, h1: p.h1,
        meta_description: p.meta_description, word_count: p.word_count,
        seo_score: p.seo_score, http_status: p.http_status,
        issues: p.issues, internal_links: p.internal_links,
        external_links: p.external_links, images_total: p.images_total,
        images_without_alt: p.images_without_alt, schema_org_types: p.schema_org_types,
        has_canonical: p.has_canonical, has_noindex: p.has_noindex,
        response_time_ms: p.response_time_ms, html_size_bytes: p.html_size_bytes,
      })),
      avgScore,
      totalPages: pages.length,
      aiSummary,
      aiRecommendations,
    },
    sourceFunctions: ['process-crawl-queue', 'crawl-site'],
  }).catch(() => {});

  // ═══ Feed keyword_universe SSOT ═══
  await feedKeywordUniverse(supabase, job, pages);

  await supabase.from('crawl_jobs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', job.id);

  console.log(`[Worker] ✅ Job ${job.id} finalized: ${pages.length} pages, avg score ${avgScore}/200`);

  // ── Trigger Voice Tone Analysis (fire-and-forget) ──
  triggerVoiceToneAnalysis(job.crawl_id);
}

// ── AI Summary generation ──────────────────────────────────
async function generateAISummary(
  pages: any[],
  job: any,
  avgScore: number,
  duplicateIssues: Record<string, string[]>,
  failedUrls: Array<{ url: string; reason: string }>,
): Promise<{ summary: string; recommendations: any[] }> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey || pages.length === 0) {
    return {
      summary: `Crawl terminé: ${pages.length} pages analysées, score moyen ${avgScore}/200.`,
      recommendations: [],
    };
  }

  const issuesSummary: Record<string, number> = {};
  pages.forEach((p: any) => ((p.issues as string[]) || []).forEach(issue => {
    issuesSummary[issue] = (issuesSummary[issue] || 0) + 1;
  }));

  let duplicateTitleCount = 0, duplicateMetaCount = 0, nearDuplicateCount = 0;
  for (const issues of Object.values(duplicateIssues)) {
    if (issues.includes('duplicate_title')) duplicateTitleCount++;
    if (issues.includes('duplicate_meta_description')) duplicateMetaCount++;
    if (issues.includes('near_duplicate_content')) nearDuplicateCount++;
  }

  const topIssues = Object.entries(issuesSummary)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([issue, count]) => `${issue}: ${count} pages`);

  const bestPages = [...pages].sort((a: any, b: any) => (b.seo_score || 0) - (a.seo_score || 0)).slice(0, 5);
  const worstPages = [...pages].sort((a: any, b: any) => (a.seo_score || 0) - (b.seo_score || 0)).slice(0, 5);

  const avgResponseTime = pages.filter((p: any) => p.response_time_ms).length > 0
    ? Math.round(pages.filter((p: any) => p.response_time_ms).reduce((s: number, p: any) => s + (p.response_time_ms || 0), 0) / pages.filter((p: any) => p.response_time_ms).length)
    : null;

  const schemaPages = pages.filter((p: any) => p.schema_org_types?.length > 0);
  const schemaErrorPages = pages.filter((p: any) => p.schema_org_errors?.length > 0);

  // Compute TRUE orphan pages
  const normalizeUrl = (u: string) => {
    try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; }
  };
  const inboundCount = new Map<string, number>();
  pages.forEach((p: any) => inboundCount.set(normalizeUrl(p.url), 0));
  for (const page of pages) {
    for (const link of (page.anchor_texts || [])) {
      if (link.type === 'internal') {
        const targetPath = normalizeUrl(link.href.startsWith('/') ? `https://x${link.href}` : link.href);
        if (inboundCount.has(targetPath)) {
          inboundCount.set(targetPath, (inboundCount.get(targetPath) || 0) + 1);
        }
      }
    }
  }
  const trueOrphanCount = [...inboundCount.values()].filter(c => c === 0).length;
  const homePath = normalizeUrl(`https://${job.domain}/`);
  const orphanCount = inboundCount.get(homePath) === 0 ? Math.max(0, trueOrphanCount - 1) : trueOrphanCount;

  // ── Gap analysis ──
  const urlsRequested = (job.urls_to_process as string[] || []).length;
  const gapCount = Math.max(0, urlsRequested - pages.length);
  let gapContext = '';
  if (gapCount > 0 || failedUrls.length > 0) {
    const reasonCounts: Record<string, number> = {};
    for (const f of failedUrls) {
      const reason = f.reason.includes('timeout') ? 'timeout' :
        f.reason.includes('404') ? 'http_404' :
        f.reason.includes('403') || f.reason.includes('401') ? 'auth_blocked' :
        f.reason.includes('redirect') ? 'redirect' :
        f.reason.includes('empty_content') ? 'empty_content' :
        'fetch_error';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }

    const reasonLabels: Record<string, string> = {
      timeout: 'timeout de connexion',
      http_404: 'erreur 404 (page introuvable)',
      auth_blocked: 'accès bloqué (401/403)',
      redirect: 'redirection',
      empty_content: 'contenu vide ou inaccessible (SPA/JS)',
      fetch_error: 'erreur de récupération',
    };

    const reasonLines = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => `  - ${count} ${reasonLabels[reason] || reason}`)
      .join('\n');

    const redirectPages = pages.filter((p: any) => p.redirect_url).length;
    const errorStatusPages = pages.filter((p: any) => p.http_status >= 400).length;

    gapContext = `
ÉCART DE CRAWL:
- ${urlsRequested} URLs soumises au crawl, ${pages.length} pages effectivement analysées (${gapCount} URLs non récupérées)
${reasonLines ? `Raisons des échecs:\n${reasonLines}` : ''}
${redirectPages > 0 ? `- ${redirectPages} pages avec redirection détectée parmi les pages crawlées` : ''}
${errorStatusPages > 0 ? `- ${errorStatusPages} pages avec erreur HTTP (4xx/5xx) parmi les pages crawlées` : ''}
IMPORTANT: Dans ta synthèse, explique brièvement cet écart de manière contextualisée pour ce site (1 à 3 phrases).`;
  }

  const prompt = `Tu es un expert SEO senior. Analyse ce crawl de ${job.domain} (${pages.length} pages, score moyen: ${avgScore}/200).

PROBLÈMES DÉTECTÉS:
${topIssues.join('\n')}

MEILLEURES PAGES:
${bestPages.map((p: any) => `- ${p.path} (${p.seo_score}/200)`).join('\n')}

PIRES PAGES:
${worstPages.map((p: any) => `- ${p.path} (${p.seo_score}/200) — Problèmes: ${(p.issues || []).join(', ')}`).join('\n')}
${gapContext}
STATS DÉTAILLÉES:
- Pages avec Schema.org: ${schemaPages.length}/${pages.length}
- Pages avec Schema.org valide (sans erreurs): ${schemaPages.length - schemaErrorPages.length}/${pages.length}
- Pages avec erreurs Schema.org: ${schemaErrorPages.length}
- Pages avec canonical: ${pages.filter((p: any) => p.has_canonical).length}/${pages.length}
- Pages avec OG: ${pages.filter((p: any) => p.has_og).length}/${pages.length}
- Pages noindex: ${pages.filter((p: any) => p.has_noindex).length}
- Pages nofollow: ${pages.filter((p: any) => p.has_nofollow).length}
- Titres dupliqués: ${duplicateTitleCount} pages
- Meta descriptions dupliquées: ${duplicateMetaCount} pages
- Contenu quasi-dupliqué (hash): ${nearDuplicateCount} pages
- Contenu fin (<100 mots): ${pages.filter((p: any) => (p.word_count || 0) < 100).length}
- Images sans alt: ${pages.reduce((s: number, p: any) => s + (p.images_without_alt || 0), 0)}
- Pages orphelines (0 liens entrants): ${orphanCount}
- H1 multiples: ${pages.filter((p: any) => ((p.issues as string[]) || []).includes('multiple_h1')).length}
- H2 manquants: ${pages.filter((p: any) => (p.h2_count || 0) === 0).length}/${pages.length}
${avgResponseTime ? `- Temps de réponse moyen: ${avgResponseTime}ms` : ''}

Réponds en JSON STRICT:
{
  "summary": "Synthèse narrative en 3-4 phrases (en français), couvrant les forces et faiblesses du site.${gapCount > 0 ? ' Inclure une explication contextualisée de l\'écart entre les pages détectées et celles effectivement crawlées.' : ''}",
  "recommendations": [
    {"priority": "critical|high|medium", "title": "Titre court", "description": "Détail actionnable", "affected_pages": 12}
  ]${gapCount > 0 ? `,
  "crawl_gap_explanation": "Explication en 1-3 phrases de pourquoi ${gapCount} pages n'ont pas pu être analysées, contextualisée pour ce site spécifique."` : ''}
}
Donne 5-8 recommandations max, classées par impact.`;

  try {
    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 60000);
    const aiRes = await fetch('https://ai.gateway.lovable.dev/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
      signal: aiController.signal,
    });
    clearTimeout(aiTimeout);

    const aiData = await aiRes.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(aiContent);
    let summary = parsed.summary || '';
    if (parsed.crawl_gap_explanation) {
      summary += '\n\n📊 ' + parsed.crawl_gap_explanation;
    }
    return {
      summary,
      recommendations: (parsed.recommendations || []).slice(0, 10),
    };
  } catch (e) {
    console.warn(`[Worker] AI summary failed:`, e);
    return {
      summary: `Crawl terminé: ${pages.length} pages analysées, score moyen ${avgScore}/200.`,
      recommendations: [],
    };
  }
}

// ── Keyword universe feed ──────────────────────────────────
async function feedKeywordUniverse(supabase: any, job: any, pages: any[]) {
  try {
    const { data: tsRow } = await supabase
      .from('tracked_sites')
      .select('id')
      .ilike('domain', `%${job.domain}%`)
      .limit(1)
      .maybeSingle();

    const kwMap = new Map<string, { keyword: string; target_url: string; intent: string }>();
    for (const page of pages) {
      const p = page as any;
      if (p.has_noindex) continue;

      if (p.title && p.title.length > 3) {
        const titleKw = p.title.trim().toLowerCase().substring(0, 100);
        if (!kwMap.has(titleKw)) {
          kwMap.set(titleKw, { keyword: titleKw, target_url: p.url, intent: 'navigational' });
        }
      }

      if (p.h1 && p.h1.length > 3) {
        const h1Kw = p.h1.trim().toLowerCase().substring(0, 100);
        if (!kwMap.has(h1Kw) && h1Kw !== p.title?.trim().toLowerCase()) {
          kwMap.set(h1Kw, { keyword: h1Kw, target_url: p.url, intent: 'informational' });
        }
      }
    }

    const kwPayload = Array.from(kwMap.values()).slice(0, 200).map(kw => ({
      keyword: kw.keyword,
      search_volume: 0,
      position: null,
      intent: kw.intent,
      target_url: kw.target_url,
    }));

    if (kwPayload.length > 0) {
      await supabase.rpc('upsert_keyword_universe', {
        p_domain: job.domain,
        p_user_id: job.user_id,
        p_keywords: kwPayload,
        p_source: 'crawl',
        p_tracked_site_id: tsRow?.id || null,
      });
      console.log(`[Worker] ✅ keyword_universe: ${kwPayload.length} keywords upserted from crawl`);

      classifyAndAssignRings(
        job.domain,
        job.user_id,
        tsRow?.id || null,
        kwPayload.map(kw => ({ keyword: kw.keyword, target_url: kw.target_url })),
      ).catch(e => console.warn('[Worker] spiral classification failed (non-fatal):', e));
    }
  } catch (e) {
    console.warn('[Worker] keyword_universe upsert failed (non-fatal):', e);
  }
}

// ── Voice Tone trigger ─────────────────────────────────────
function triggerVoiceToneAnalysis(crawlId: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    fetch(`${supabaseUrl}/functions/v1/analyze-voice-tone`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'analyze_pages', crawl_id: crawlId }),
    }).then(() => {
      console.log(`[Worker] 🎤 Voice tone analysis triggered for crawl ${crawlId}`);
    }).catch((e: any) => {
      console.warn(`[Worker] Voice tone trigger failed (non-blocking):`, e);
    });
  } catch (e) {
    console.warn(`[Worker] Voice tone trigger setup failed:`, e);
  }
}
