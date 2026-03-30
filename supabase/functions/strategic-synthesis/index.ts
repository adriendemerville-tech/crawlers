/**
 * strategic-synthesis — Micro-function #4 (v2: parallel split)
 * Takes aggregated data from crawl/market/competitors/llm and runs 3 parallel LLM calls.
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { trackTokenUsage, trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { trackAnalyzedUrl } from '../_shared/trackUrl.ts'
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts'
import { SYSTEM_PROMPT_A, SYSTEM_PROMPT_B, SYSTEM_PROMPT_C, buildUserPromptA, buildUserPromptB, buildUserPromptC, mergeParallelResults, parseLLMJson } from '../_shared/strategicSplitPrompts.ts'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

// Content mode system prompt (for editorial/product/deep pages — uses monolithic single call)
const CONTENT_SYSTEM_PROMPT = `RÔLE: Senior Content SEO Strategist spécialisé en optimisation d'articles pour les moteurs de réponse IA (GEO).
MODE ÉDITORIAL/PRODUIT/DEEP: Analyse centrée sur la PAGE spécifique, pas l'entreprise.`;

const CONTENT_FULL_PROMPT = `RÔLE: Senior Content SEO Strategist spécialisé GEO.
Analyse centrée sur la PAGE spécifique. Génère JSON complet avec: introduction, brand_authority, social_signals, market_intelligence, competitive_landscape, geo_citability, llm_visibility, conversational_intent, zero_click_risk, priority_content, keyword_positioning, market_data_summary, executive_roadmap (MIN 6), client_targets, executive_summary, overallScore, quotability, summary_resilience, lexical_footprint, expertise_sentiment, red_team.`;

function formatToolsDataToMarkdown(toolsData: any): string {
  const lines: string[] = [];
  if (toolsData?.crawlers) { const c = toolsData.crawlers; lines.push('## CRAWLERS'); if (c.overallScore != null) lines.push(`Score: ${c.overallScore}/100`); if (c.bots) for (const b of c.bots) if (b.name) lines.push(`- ${b.name}: ${b.isAllowed ? '✅' : '❌'}`); if (c.recommendations) lines.push(`Recs: ${c.recommendations.slice(0, 5).join('; ')}`); }
  if (toolsData?.geo) { const g = toolsData.geo; lines.push('## GEO'); if (g.overallScore != null) lines.push(`Score: ${g.overallScore}/100`); if (g.factors) for (const f of g.factors) if (f.name) lines.push(`- ${f.name}: ${f.score ?? f.status ?? '?'}`); if (g.recommendations) lines.push(`Recs: ${g.recommendations.slice(0, 5).join('; ')}`); }
  if (toolsData?.llm) { const l = toolsData.llm; lines.push('## LLM'); if (l.overallScore != null) lines.push(`Score: ${l.overallScore}/100`); if (l.brandMentioned != null) lines.push(`Brand: ${l.brandMentioned}`); if (l.models) for (const m of l.models) if (m.name) lines.push(`- ${m.name}: mentioned=${m.brandMentioned ?? '?'}`); }
  if (toolsData?.pagespeed) { const p = toolsData.pagespeed; lines.push('## PAGESPEED'); if (p.overallScore != null) lines.push(`Score: ${p.overallScore}/100`); if (p.lcp != null) lines.push(`LCP: ${p.lcp}ms`); }
  return lines.join('\n');
}

// ── MAIN HANDLER ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json();
    const { url, domain, crawlData, marketData, competitorsData, llmData, toolsData, lang, hallucinationCorrections, competitorCorrections } = body;

    if (!url || !domain || !LOVABLE_API_KEY) return json({ error: 'Missing required fields' }, 400);

    const startTime = Date.now();
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const parsedUrl = new URL(normalizedUrl);
    const domainWithoutWww = parsedUrl.hostname.replace(/^www\./, '');
    const domainSlug = domainWithoutWww.split('.')[0];

    // ── Extract data from micro-functions ──
    const pageContentContext = crawlData?.pageContentContext || '';
    const brandSignals = crawlData?.brandSignals || [];
    const eeatSignals = crawlData?.eeatSignals || {};
    const ctaSeoSignals = crawlData?.ctaSeoSignals || {};
    const businessContext = crawlData?.businessContext || {};

    const mktData = marketData?.marketData || null;
    const rankingOverview = marketData?.rankingOverview || null;

    const competitors = competitorsData?.competitors || null;
    const founderInfo = competitorsData?.founderInfo || { name: null, profileUrl: null, platform: null, isInfluencer: false, geoMismatch: false, detectedCountry: null };
    const gmbData = competitorsData?.gmbData || null;
    const facebookPageInfo = competitorsData?.facebookPageInfo || { pageUrl: null, pageName: null, found: false };

    // ── Page type detection ──
    const urlPath = parsedUrl.pathname.toLowerCase();
    const pathSegments = urlPath.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
    const editorialPattern = /\/(blog|article|articles|post|posts|news|actualite|guide|tutoriel|tutorial|ressources|wiki|faq)\b/;
    const productPattern = /\/(product|produit|products|shop|boutique|store|catalogue|pricing|tarif|offre|service|solution)\b/;
    let pageType = 'homepage';
    if (editorialPattern.test(urlPath) && pathSegments.length >= 2) pageType = 'editorial';
    else if (productPattern.test(urlPath)) pageType = 'product';
    else if (pathSegments.length >= 3) pageType = 'deep';
    else if (pathSegments.length >= 1 && urlPath !== '/') { const last = pathSegments[pathSegments.length - 1]; if (last.length > 60 || last.split('-').length > 6) pageType = 'deep'; }
    const isContentMode = pageType !== 'homepage';

    // ── Brand resolution ──
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüÿçœæ0-9]/g, '').trim();
    const groups = new Map<string, { totalWeight: number; bestValue: string; sources: string[] }>();
    for (const sig of brandSignals) {
      if (sig.value.trim().length > 40) continue;
      const norm = normalize(sig.value.trim());
      if (!norm || norm.length < 2) continue;
      const ex = groups.get(norm);
      if (ex) { ex.totalWeight += sig.weight; ex.sources.push(sig.source); if (sig.value.length >= ex.bestValue.length) ex.bestValue = sig.value; }
      else groups.set(norm, { totalWeight: sig.weight, bestValue: sig.value, sources: [sig.source] });
    }
    let resolvedEntityName = url;
    let brandConfidence = 0;
    if (groups.size > 0) {
      const totalWeight = brandSignals.reduce((s: number, sig: any) => s + sig.weight, 0);
      let best = { norm: '', totalWeight: 0, bestValue: '', sources: [] as string[] };
      for (const [norm, g] of groups) if (g.totalWeight > best.totalWeight) best = { norm, ...g };
      let conf = best.totalWeight / totalWeight;
      if (best.sources.length >= 3) conf = Math.min(1, conf + 0.15);
      else if (best.sources.length >= 2) conf = Math.min(1, conf + 0.08);
      brandConfidence = conf;
      let finalName = best.bestValue.trim();
      if (finalName === finalName.toLowerCase() && finalName.length > 1) finalName = finalName.replace(/\b\w/g, c => c.toUpperCase());
      if (conf >= 0.95) resolvedEntityName = finalName;
    }
    const humanBrandName = brandConfidence >= 0.95 ? resolvedEntityName : domainSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // ── Language ──
    const normalizedLang = lang === 'fr' || lang === 'en' || lang === 'es'
      ? lang
      : businessContext?.languageCode === 'en' || businessContext?.languageCode === 'es'
        ? businessContext.languageCode
        : 'fr';
    const langMap: Record<string, string> = { fr: 'français', en: 'English', es: 'español' };
    const langLabel = langMap[normalizedLang] || 'français';
    const strictLanguageInstruction = normalizedLang === 'en'
      ? 'You MUST write the full analysis entirely in English. All narrative fields, summaries, recommendations and labels must be in English.'
      : normalizedLang === 'es'
        ? 'Debes redactar todo el análisis exclusivamente en español. Todos los textos narrativos, resúmenes, recomendaciones y etiquetas deben estar en español.'
        : 'Tu DOIS rédiger toute l’analyse exclusivement en français. Tous les champs narratifs, résumés, recommandations et libellés doivent être en français.';

    // ── Build shared context ──
    let marketSection = '';
    if (mktData?.top_keywords) {
      const kwList = mktData.top_keywords.map((kw: any) => `"${kw.keyword}":${kw.volume}vol,diff${kw.difficulty},pos:${kw.current_rank}`).join('; ');
      const quickWins = mktData.top_keywords.filter((kw: any) => typeof kw.current_rank === 'number' && kw.current_rank >= 11 && kw.current_rank <= 20 && kw.volume > 100);
      const missing = mktData.top_keywords.filter((kw: any) => !kw.is_ranked && kw.volume > 200);
      marketSection = `📊 DONNÉES MARCHÉ - Volume: ${mktData.total_market_volume}\nMots-clés: ${kwList}\nQuick Wins: ${quickWins.length > 0 ? quickWins.map((kw: any) => `"${kw.keyword}" pos${kw.current_rank}(${kw.volume}vol)`).join(', ') : 'Aucun'}\nManquants: ${missing.length > 0 ? missing.map((kw: any) => `"${kw.keyword}"(${kw.volume}vol)`).join(', ') : 'Aucun'}`;
    } else { marketSection = '⚠️ DataForSEO non disponible.'; }
    if (rankingOverview) {
      marketSection += `\n📈 SEO: ${rankingOverview.total_ranked_keywords} mots-clés, pos moy=${rankingOverview.average_position_global}, Top10=${rankingOverview.average_position_top10 || 'N/A'}, ETV=${rankingOverview.etv}`;
    }

    let eeatSection = '';
    if (eeatSignals) {
      const yn = (v: boolean) => v ? 'OUI' : 'NON';
      eeatSection = `🔍 E-E-A-T: AuthorBio=${yn(eeatSignals.hasAuthorBio)}(${eeatSignals.authorBioCount || 0}), AuthorJsonLD=${yn(eeatSignals.hasAuthorInJsonLd)}, Person=${yn(eeatSignals.hasPerson)}, Organization=${yn(eeatSignals.hasOrganization)}, sameAs=${yn(eeatSignals.hasSameAs)}, Wikidata=${yn(eeatSignals.hasWikidataSameAs)}, SocialLinks=${eeatSignals.socialLinksCount || 0}`;
      if (eeatSignals.detectedSocialUrls?.length > 0) eeatSection += `\nURLs sociales: ${eeatSignals.detectedSocialUrls.slice(0, 10).join(', ')}`;
      if (facebookPageInfo?.found) eeatSection += `\n📘 Facebook: ${facebookPageInfo.pageName} → ${facebookPageInfo.pageUrl}`;
    }

    let founderSection = '';
    if (!isContentMode && founderInfo?.name && !founderInfo.geoMismatch) {
      founderSection = `\n👤 FONDATEUR: ${founderInfo.name} (${founderInfo.platform || '?'})${founderInfo.profileUrl ? ` URL:${founderInfo.profileUrl}` : ''}`;
    } else if (founderInfo?.geoMismatch) {
      founderSection = `\n⚠️ Fondateur homonyme étranger (${founderInfo.detectedCountry}) — NE PAS mentionner.`;
    }

    const toolsMarkdown = formatToolsDataToMarkdown(toolsData || {});

    let baseContext = `🌐 LANGUE: ${langLabel}. Rédige en ${langLabel}.\n🔒 CONSIGNE DE LANGUE: ${strictLanguageInstruction}\n🏷️ ENTITÉ: "${resolvedEntityName}"\n`;
    if (competitors?.length > 0) {
      const compLines = competitors.map((c: any, i: number) => `  ${i + 1}. "${c.name}" URL:${c.url || 'N/A'} Score:${c.score || 0}`).join('\n');
      baseContext += `🏙️ CONCURRENTS:\n${compLines}\n`;
    }
    if (hallucinationCorrections) {
      const corrections = Object.entries(hallucinationCorrections).filter(([_, v]) => v).map(([k, v]) => `${k}="${v}"`).join(', ');
      if (corrections) baseContext += `⚠️ CORRECTIONS: ${corrections}\n`;
    }
    if (competitorCorrections) {
      const parts: string[] = [];
      if (competitorCorrections.leader?.name) parts.push(`Leader:"${competitorCorrections.leader.name}"`);
      if (competitorCorrections.direct_competitor?.name) parts.push(`Concurrent:"${competitorCorrections.direct_competitor.name}"`);
      if (parts.length > 0) baseContext += `🏢 CONCURRENTS CORRIGÉS: ${parts.join(', ')}\n`;
    }
    baseContext += `Analyse "${url}" (${domain}).\n${pageContentContext}\n${eeatSection}${founderSection}\n${marketSection}\n${toolsMarkdown}`;

    // ── LLM Call helper ──
    async function callLLM(model: string, timeoutMs: number, systemPrompt: string, userPromptText: string, label: string): Promise<string | null> {
      const logLabel = `[strategic-synthesis:${label}]`;
      try {
        console.log(`🤖 ${logLabel} ${model} (timeout: ${Math.round(timeoutMs / 1000)}s)`);
        const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: `${strictLanguageInstruction}\n\n${systemPrompt}` }, { role: 'user', content: userPromptText }], temperature: 0.3, max_tokens: 16384 }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`❌ ${logLabel} ${model} error: ${resp.status} ${errText.substring(0, 200)}`);
          return null;
        }
        const aiResp = await resp.json();
        const content = aiResp.choices?.[0]?.message?.content;
        trackTokenUsage(`strategic-synthesis-${label}`, model, aiResp.usage, url);
        return content || null;
      } catch (e) {
        console.warn(`⚠️ ${logLabel} ${model} failed: ${e instanceof Error ? e.message : e}`);
        return null;
      }
    }

    async function callWithFallback(systemPrompt: string, userPromptText: string, label: string, timeoutMs: number): Promise<any | null> {
      const model = label === 'A-identity' ? (body.modelOverride || 'google/gemini-2.5-pro') : (body.modelOverride || 'google/gemini-2.5-flash');
      const callTimeout = Math.min(timeoutMs, label === 'A-identity' ? 120_000 : 90_000);
      let raw = await callLLM(model, callTimeout, systemPrompt, userPromptText, label);
      if (!raw && model !== 'google/gemini-2.5-flash') {
        console.log(`🔄 ${label}: Retrying with Flash...`);
        raw = await callLLM('google/gemini-2.5-flash', Math.min(60_000, timeoutMs - 5000), systemPrompt, userPromptText, label);
      }
      if (!raw) return null;
      const parsed = parseLLMJson(raw);
      if (!parsed) console.warn(`⚠️ ${label}: JSON parse failed`);
      return parsed;
    }

    let parsedAnalysis: any = null;

    if (isContentMode) {
      // ═══ CONTENT MODE: Single call (simpler JSON) ═══
      console.log(`🤖 [strategic-synthesis] Content mode (${pageType}) — single LLM call`);
      const userPrompt = baseContext + `\n\nGÉNÈRE un JSON complet avec: introduction, brand_authority, social_signals, market_intelligence, competitive_landscape, geo_citability, llm_visibility, conversational_intent, zero_click_risk, priority_content, keyword_positioning, market_data_summary, executive_roadmap (MIN 6), client_targets, executive_summary, overallScore, quotability, summary_resilience, lexical_footprint, expertise_sentiment, red_team.\nRÈGLES: main_keywords MIN 5, executive_roadmap MIN 6, pas d'auto-citation, JSON pur.`;
      let raw = await callLLM(body.modelOverride || 'google/gemini-2.5-pro', 150_000, CONTENT_FULL_PROMPT, userPrompt, 'content');
      if (!raw) {
        raw = await callLLM('google/gemini-2.5-flash', 120_000, CONTENT_FULL_PROMPT, userPrompt, 'content-flash');
      }
      if (raw) parsedAnalysis = parseLLMJson(raw);

    } else {
      // ═══ HOMEPAGE MODE: 3 parallel calls ═══
      console.log('🚀 [strategic-synthesis] Parallel mode: 3 focused LLM calls...');

      const userPromptA = buildUserPromptA(url, domain, baseContext);
      const userPromptB = buildUserPromptB(url, domain, baseContext);
      const userPromptC = buildUserPromptC(url, domain, baseContext);

      const parallelTimeout = 150_000;

      const [resultA, resultB, resultC] = await Promise.all([
        callWithFallback(SYSTEM_PROMPT_A, userPromptA, 'A-identity', parallelTimeout),
        callWithFallback(SYSTEM_PROMPT_B, userPromptB, 'B-market', parallelTimeout),
        callWithFallback(SYSTEM_PROMPT_C, userPromptC, 'C-geo', parallelTimeout),
      ]);

      const successCount = [resultA, resultB, resultC].filter(Boolean).length;
      console.log(`✅ Parallel results: ${successCount}/3 (A:${!!resultA} B:${!!resultB} C:${!!resultC})`);

      if (successCount === 0) {
        console.warn('⚠️ All 3 parallel calls failed');
        return json({ success: true, data: { url, domain: domainWithoutWww, scannedAt: new Date().toISOString(), overallScore: 0, introduction: { presentation: 'Analyse interrompue.', strengths: '', improvement: '', competitors: [] }, executive_roadmap: [], executive_summary: 'Analyse interrompue.', _error: 'All LLM calls failed' } });
      }

      parsedAnalysis = mergeParallelResults(resultA, resultB, resultC);
      console.log(`✅ Merged parallel results in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    }

    if (!parsedAnalysis) return json({ success: true, data: { url, domain: domainWithoutWww, scannedAt: new Date().toISOString(), overallScore: 0, introduction: { presentation: 'Analyse interrompue.', strengths: '', improvement: '', competitors: [] }, executive_roadmap: [], executive_summary: 'Analyse interrompue.', _error: 'No analysis produced' } });

    // ── Brand sanitization ──
    function sanitize(obj: any, slug: string, name: string): any {
      if (!obj || !slug || !name || slug === name) return obj;
      const re = new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      function walk(n: any): any {
        if (typeof n === 'string') return n.replace(re, name);
        if (Array.isArray(n)) return n.map(walk);
        if (n && typeof n === 'object') { const o: any = {}; for (const [k, v] of Object.entries(n)) o[k] = walk(v); return o; }
        return n;
      }
      return walk(obj);
    }
    parsedAnalysis = sanitize(parsedAnalysis, domainSlug, humanBrandName);

    // ── Supplement main_keywords if < 5 ──
    if (parsedAnalysis.keyword_positioning?.main_keywords?.length < 5 && mktData?.top_keywords) {
      const mk = parsedAnalysis.keyword_positioning.main_keywords;
      const ex = new Set(mk.map((k: any) => (k.keyword || '').toLowerCase()));
      for (const kw of mktData.top_keywords) {
        if (mk.length >= 5) break;
        if (!ex.has(kw.keyword.toLowerCase())) { ex.add(kw.keyword.toLowerCase()); mk.push({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, current_rank: kw.current_rank || 'Non classé' }); }
      }
    }

    // ── Force-compute quotability & summary_resilience ──
    {
      const rawText = (pageContentContext || '').replace(/Titre="[^"]*"/g, '').replace(/H1="[^"]*"/g, '').replace(/Desc="[^"]*"/g, '');
      const sentences = rawText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 40 && s.length < 300);
      const markers = [/\d+\s*%/i, /\d+\s*(fois|x|million)/i, /permet|offre|garantit|réduit|augmente/i, /premier|unique|seul|leader/i, /grâce à|en seulement|jusqu'à/i];
      const scored = sentences.map(s => { let sc = 0; for (const m of markers) if (m.test(s)) sc++; if (!/^(il|elle|ce|cette|it|they|this)\b/i.test(s)) sc++; return { text: s, sc }; }).sort((a, b) => b.sc - a.sc);
      const topQ = scored.slice(0, 3).filter(q => q.sc > 0).map(q => q.text);
      const allQ = [...new Set([...(parsedAnalysis.quotability?.quotes || []), ...topQ])].slice(0, 3);
      parsedAnalysis.quotability = { score: Math.min(100, allQ.length * 33), quotes: allQ };

      const h1M = (pageContentContext || '').match(/H1="([^"]+)"/);
      const tM = (pageContentContext || '').match(/Titre="([^"]+)"/);
      const origH1 = h1M?.[1] || tM?.[1] || 'Non détecté';
      const paras = rawText.split(/\n+/).filter(p => p.trim().length > 50);
      const fp = paras[0] || '';
      const h1Terms = origH1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const cLower = (fp + ' ' + rawText.slice(0, 1000)).toLowerCase();
      const matched = h1Terms.filter(t => cLower.includes(t));
      const resScore = h1Terms.length > 0 ? Math.round((matched.length / h1Terms.length) * 100) : 0;
      parsedAnalysis.summary_resilience = { score: parsedAnalysis.summary_resilience?.score || resScore, originalH1: origH1, llmSummary: parsedAnalysis.summary_resilience?.llmSummary || fp.slice(0, 80).replace(/[.!?,;:]+$/, '').trim() || 'Non disponible' };
    }

    if (!parsedAnalysis.lexical_footprint) parsedAnalysis.lexical_footprint = { jargonRatio: 50, concreteRatio: 50 };
    if (!parsedAnalysis.expertise_sentiment) parsedAnalysis.expertise_sentiment = { rating: 1, justification: 'Non évalué' };
    if (!parsedAnalysis.red_teaming) parsedAnalysis.red_teaming = { objections: [] };

    // ── Jargon distance (lightweight Flash call) ──
    let jargonDistance: any = null;
    if (parsedAnalysis.client_targets && pageContentContext) {
      try {
        const ct = parsedAnalysis.client_targets;
        const jPrompt = `Analyse la DISTANCE SÉMANTIQUE entre ce contenu et les cibles.\n${pageContentContext}\nPRIMAIRE: ${JSON.stringify(ct.primary?.[0] || 'Non détecté')}\nSECONDAIRE: ${JSON.stringify(ct.secondary?.[0] || 'Non détecté')}\nPOTENTIELLE: ${JSON.stringify(ct.untapped?.[0] || 'Non détecté')}\n\nJSON: {"primary":{"distance":0,"qualifier":"...","terms_causing_distance":[...],"confidence":0.0},"secondary":{...},"untapped":{...},"tone_consistency":0.0,"tone_assertive_ratio":0.0}`;
        const jr = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST', headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: jPrompt }], temperature: 0.3 }),
          signal: AbortSignal.timeout(15000),
        });
        if (jr.ok) {
          const jd = await jr.json(); const jt = jd.choices?.[0]?.message?.content || '';
          trackTokenUsage('strategic-synthesis', 'google/gemini-2.5-flash', jd.usage, url);
          try {
            const jp = JSON.parse(jt.replace(/```json\s*/g, '').replace(/```/g, '').trim());
            const cta = ctaSeoSignals || {};
            const ctaScore = Math.min(1, (cta.ctaAggressive ? 0.6 : 0) + (cta.ctaCount >= 3 ? 0.2 : cta.ctaCount >= 1 ? 0.1 : 0));
            const primaryTerms = jp.primary?.terms_causing_distance || [];
            const balisesJoined = (cta.seoTermsInBalises || []).join(' ');
            const termsInBalises = primaryTerms.filter((t: string) => balisesJoined.includes(t.toLowerCase())).length;
            const seoAlignment = primaryTerms.length > 0 ? Math.min(1, termsInBalises / Math.max(1, primaryTerms.length)) : 0.5;
            const toneAssertive = jp.tone_assertive_ratio ?? 0.5;
            const toneConsistency = jp.tone_consistency ?? 0.5;
            const iScore = (ctaScore * 0.30) + (seoAlignment * 0.30) + (toneAssertive * 0.20) + (toneConsistency * 0.20);
            const iLabel = iScore > 0.65 ? 'Spécialisation assumée' : iScore > 0.35 ? 'Positionnement ambigu' : 'Distance non maîtrisée';
            jargonDistance = { primary: jp.primary, secondary: jp.secondary, untapped: jp.untapped, intentionality: { score: Math.round(iScore * 100) / 100, label: iLabel, components: { cta_aggressiveness: Math.round(ctaScore * 100) / 100, seo_pattern_alignment: Math.round(seoAlignment * 100) / 100, tone_assertiveness: Math.round(toneAssertive * 100) / 100, structural_consistency: Math.round(toneConsistency * 100) / 100 } } };
            parsedAnalysis.lexical_footprint = { ...parsedAnalysis.lexical_footprint, jargon_distance: jargonDistance };
          } catch { }
        }
      } catch { }
    }

    // ── Build final result ──
    const cachedContextOut = { pageContentContext, brandSignals, eeatSignals, marketData: mktData, rankingOverview, founderInfo, llmData, gmbData, facebookPageInfo };
    const result = {
      success: true,
      data: {
        url, domain: domainWithoutWww,
        scannedAt: new Date().toISOString(),
        isContentMode, pageType,
        ...parsedAnalysis,
        raw_market_data: mktData,
        ranking_overview: rankingOverview,
        google_my_business: gmbData,
        toolsData: null,
        llm_visibility_raw: llmData,
        _cachedContext: cachedContextOut,
      },
    };

    console.log(`✅ [strategic-synthesis] Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // ── Persist client_targets + jargon_distance ──
    if (domainWithoutWww && (parsedAnalysis?.client_targets || jargonDistance)) {
      try {
        const svc = getServiceClient(); const up: Record<string, any> = {};
        if (parsedAnalysis?.client_targets) up.client_targets = parsedAnalysis.client_targets;
        if (jargonDistance) up.jargon_distance = jargonDistance;
        await svc.from('tracked_sites').update(up).ilike('domain', `%${domainWithoutWww}%`);
      } catch { }
    }

    // ── Save recommendations + raw data (fire-and-forget) ──
    const authHeader = req.headers.get('Authorization') || '';
    if (authHeader) {
      try {
        const ub = getUserClient(authHeader); const { data: { user } } = await ub.auth.getUser();
        if (user) {
          trackAnalyzedUrl(url).catch(() => { });
          saveRawAuditData({ userId: user.id, url, domain: domainWithoutWww, auditType: 'strategic', rawPayload: result.data, sourceFunctions: ['strategic-orchestrator'] }).catch(() => { });
          if (parsedAnalysis.executive_roadmap?.length) {
            const entries = parsedAnalysis.executive_roadmap.map((item: any, idx: number) => ({
              user_id: user.id, domain: domainWithoutWww, url, audit_type: 'strategic',
              recommendation_id: `roadmap_${idx}`, title: item.title || `Recommandation ${idx + 1}`,
              description: item.prescriptive_action || '', category: item.category?.toLowerCase() || 'contenu',
              priority: item.priority === 'Prioritaire' ? 'critical' : item.priority === 'Important' ? 'important' : 'optional',
              fix_type: null, fix_data: { expected_roi: item.expected_roi, category: item.category },
              prompt_summary: `[${item.priority}] ${item.title} - ${(item.prescriptive_action || '').substring(0, 200)}`,
              is_resolved: false,
            }));
            await ub.from('audit_recommendations_registry').delete().eq('user_id', user.id).eq('domain', domainWithoutWww).eq('audit_type', 'strategic');
            await ub.from('audit_recommendations_registry').insert(entries);
          }
        }
      } catch { }
    }

    return json(result);
  } catch (error) {
    console.error('❌ [strategic-synthesis] Fatal:', error);
    await trackEdgeFunctionError('strategic-synthesis', error instanceof Error ? error.message : 'Fatal').catch(() => { });
    return json({ success: true, data: { url: '', domain: '', scannedAt: new Date().toISOString(), overallScore: 0, introduction: { presentation: 'Analyse interrompue.', strengths: '', improvement: '', competitors: [] }, executive_roadmap: [], executive_summary: 'Analyse interrompue.', _error: error instanceof Error ? error.message : 'Unknown' } });
  }
});
