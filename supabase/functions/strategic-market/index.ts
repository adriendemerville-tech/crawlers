/**
 * strategic-market — Micro-function #2
 * Fetches DataForSEO keyword data, rankings, and market volume.
 * Cached for 24h via audit_cache.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { cacheKey, getCached, setCache } from '../_shared/auditCache.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

const STOP_WORDS = new Set([
  'le','la','les','de','des','du','un','une','et','est','en','pour','par','sur','au','aux',
  'il','elle','ce','cette','qui','que','son','sa','ses','se','ne','pas','avec','dans','ou',
  'plus','vous','votre','vos','nous','notre','nos','leur','leurs',
  'the','and','for','with','your','our','from','that','this','are','was','will','can','has','have',
  'gratuit','gratuite','meilleur','meilleure','site','web','page','www','http','https',
]);

function getAuthHeader(): string {
  return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;
}

function cleanAndTokenize(text: string, extraExclusions?: Set<string>): string[] {
  return text.toLowerCase().replace(/[|–—·:,\.!?]/g, ' ').replace(/[^\wàâäéèêëïîôùûüÿçœæ\s'-]/g, '').replace(/\s+/g, ' ').trim().split(' ')
    .filter(w => w.length > 1 && !STOP_WORDS.has(w) && !(extraExclusions?.has(w)));
}

function extractMetadataTexts(ctx: string): string[] {
  const t = ctx.match(/Titre="([^"?]+)/); const h = ctx.match(/H1="([^"?]+)/); const d = ctx.match(/Desc="([^"?]+)/);
  return [t?.[1], h?.[1], d?.[1]].filter(Boolean) as string[];
}

function buildDomainSlugs(domain: string): Set<string> {
  const s = new Set<string>(); const c = domain.replace(/^www\./, '').toLowerCase();
  for (const p of c.split('.')) { if (p.length > 2) s.add(p); } s.add(c.replace(/\./g, '')); s.add(c.split('.')[0]); return s;
}

function humanizeBrandName(slug: string): string {
  if (!slug) return slug;
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function extractCoreBusiness(ctx: string): string {
  if (!ctx) return '';
  const texts = extractMetadataTexts(ctx);
  const allWords: string[] = [];
  for (const text of texts) allWords.push(...cleanAndTokenize(text));
  return [...new Set(allWords)].slice(0, 8).join(' ');
}

function extractKeywordsFromMetadata(ctx: string, domain: string): string[] {
  const extracted: string[] = []; const texts = extractMetadataTexts(ctx); const slugs = buildDomainSlugs(domain);
  for (const text of texts) {
    const words = cleanAndTokenize(text, slugs).filter(w => w.length > 2);
    for (let i = 0; i < words.length - 2; i++) extracted.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    for (let i = 0; i < words.length - 1; i++) extracted.push(`${words[i]} ${words[i + 1]}`);
    for (const w of words) { if (w.length >= 5) extracted.push(w); }
  }
  return [...new Set(extracted)].slice(0, 12);
}

function generateSeedKeywords(brandName: string, sector: string, ctx: string, domain: string): string[] {
  const keywords: string[] = [];
  if (ctx) {
    const texts = extractMetadataTexts(ctx); const slugs = buildDomainSlugs(domain);
    const bigrams: string[] = [];
    for (const text of texts) { const words = cleanAndTokenize(text, slugs); for (let i = 0; i < words.length - 1; i++) bigrams.push(`${words[i]} ${words[i + 1]}`); }
    for (const bg of bigrams.slice(0, 3)) { if (bg.length > 4 && !keywords.includes(bg)) keywords.push(bg); }
    for (const mk of extractKeywordsFromMetadata(ctx, domain)) { if (mk.length > 4 && !keywords.includes(mk)) keywords.push(mk); }
  }
  const cleanBrand = brandName.toLowerCase().trim();
  if (sector.toLowerCase() !== cleanBrand && sector.length > 3 && !keywords.some(k => k.includes(sector))) keywords.push(sector);
  if (!keywords.includes(cleanBrand)) keywords.push(cleanBrand);
  return keywords.filter(kw => kw.length > 3 && !kw.includes('undefined')).slice(0, 10);
}

async function generateSeedsWithAI(url: string, ctx: string, brandName: string, mode = 'initial', feedback?: string): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return [];
  const modeInstructions: Record<string, string> = {
    initial: "Services principaux + intentions d'achat/conversion.",
    vertical: "Sous-catégories techniques, longue traîne, conversion locale.",
    horizontal: "Étapes AMONT du parcours client et besoins CONNEXES.",
  };
  const prompt = `Tu es un Senior SEO Strategist spécialisé en recherche de mots-clés à forte intention.\nURL: ${url}\n${ctx}\n\nRÈGLE: NE CITE JAMAIS "${brandName}". Mots-clés 100% GÉNÉRIQUES.\nMODE: ${mode.toUpperCase()}\n${modeInstructions[mode] || ''}\n${feedback ? `FEEDBACK: ${feedback}` : ''}\n\nGénère 15 mots-clés (2-5 mots, forte intention). JSON: {"core_business": "...", "seeds": [...]}`;
  try {
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash-lite', messages: [{ role: 'user', content: prompt }], temperature: 0.5 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) { await resp.text(); return []; }
    const data = await resp.json(); const content = data.choices?.[0]?.message?.content || '';
    trackTokenUsage('strategic-market', 'google/gemini-2.5-flash-lite', data.usage, url);
    let seeds: string[] = [];
    try {
      let j = content; if (content.includes('```json')) j = content.split('```json')[1].split('```')[0].trim(); else if (content.includes('```')) j = content.split('```')[1].split('```')[0].trim();
      j = j.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      const parsed = JSON.parse(j); seeds = (parsed.seeds || parsed.keywords || []).filter((s: string) => typeof s === 'string' && s.length > 3);
    } catch { const m = content.match(/\[([^\]]+)\]/); if (m) seeds = m[1].split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter((s: string) => s.length > 3); }
    const bl = brandName.toLowerCase(); const ds = bl.replace(/\s+/g, '');
    return seeds.filter(s => { const l = s.toLowerCase(); return !l.includes(bl) && !l.includes(ds); }).slice(0, 15);
  } catch { return []; }
}

async function fetchKeywordData(seeds: string[], locationCode: number, langCode: string): Promise<{ keyword: string; volume: number; difficulty: number }[]> {
  const all: { keyword: string; volume: number; difficulty: number }[] = [];
  const seen = new Set<string>();
  const add = (kw: { keyword: string; volume: number; difficulty: number }) => { const l = kw.keyword.toLowerCase(); if (!seen.has(l) && kw.volume >= 0) { seen.add(l); all.push(kw); } };
  try {
    const r = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST', headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keywords: seeds.slice(0, 5), location_code: locationCode, language_code: langCode, sort_by: 'search_volume', include_adult_keywords: false }]),
    });
    if (r.ok) {
      trackPaidApiCall('strategic-market', 'dataforseo', 'keywords_for_keywords');
      const d = await r.json();
      if (d.status_code === 20000 && d.tasks?.[0]?.result) for (const i of d.tasks[0].result) if (i.keyword && i.search_volume >= 0) add({ keyword: i.keyword, volume: i.search_volume || 0, difficulty: i.competition_index || Math.round((i.competition || 0.3) * 100) });
    } else { await r.text(); }

    if (all.length < 10) {
      const vr = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
        method: 'POST', headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keywords: seeds, location_code: locationCode, language_code: langCode }]),
      });
      if (vr.ok) { const vd = await vr.json(); if (vd.status_code === 20000 && vd.tasks?.[0]?.result) for (const i of vd.tasks[0].result) if (i.keyword && i.search_volume >= 0) add({ keyword: i.keyword, volume: i.search_volume || 0, difficulty: i.competition ? Math.round(i.competition * 100) : 30 }); } else { await vr.text(); }
    }

    if (all.length < 5 && seeds.length > 0) {
      const sw = seeds.flatMap(s => s.split(/\s+/)).filter(w => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase())).slice(0, 5);
      if (sw.length > 0) {
        const br = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
          method: 'POST', headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keywords: sw, location_code: locationCode, language_code: langCode, sort_by: 'search_volume', include_adult_keywords: false }]),
        });
        if (br.ok) { const bd = await br.json(); if (bd.status_code === 20000 && bd.tasks?.[0]?.result) for (const i of bd.tasks[0].result) if (i.keyword && i.search_volume >= 0) add({ keyword: i.keyword, volume: i.search_volume || 0, difficulty: i.competition_index || Math.round((i.competition || 0.3) * 100) }); } else { await br.text(); }
      }
    }
  } catch (e) { console.error('❌ Keyword error:', e); }
  return all.sort((a, b) => b.volume - a.volume).slice(0, 15);
}

async function checkRankings(keywords: { keyword: string; volume: number; difficulty: number }[], domain: string, locationCode: number, langCode: string, seDomain: string) {
  const results: any[] = []; const cd = domain.replace(/^www\./, '').toLowerCase();
  const EXCLUDED_TYPES = new Set(['paid', 'ads']);
  const check = keywords.slice(0, 10);
  try {
    const tasks = check.map(kw => ({ keyword: kw.keyword, location_code: locationCode, language_code: langCode, depth: 50, se_domain: seDomain }));
    const r = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', { method: 'POST', headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(tasks) });
    if (!r.ok) { await r.text(); return keywords.map(kw => ({ ...kw, is_ranked: false, current_rank: 'Non classé' })); }
    trackPaidApiCall('strategic-market', 'dataforseo', 'serp/organic');
    const data = await r.json();
    for (let i = 0; i < check.length; i++) {
      const kw = check[i]; const tr = data.tasks?.[i]?.result?.[0]; let position: number | string = 'Non classé'; let isRanked = false;
      if (tr?.items) {
        for (const item of tr.items) {
          if (EXCLUDED_TYPES.has(item.type)) continue;
          const id = (item.domain || '').toLowerCase().replace(/^www\./, ''); const iu = (item.url || '').toLowerCase();
          if ((id && (id === cd || id.endsWith('.' + cd) || cd.endsWith('.' + id))) || iu.includes(cd)) { position = item.rank_absolute || item.rank_group || 1; isRanked = true; break; }
          if (item.items && Array.isArray(item.items)) { for (const si of item.items) { const sd = (si.domain || '').toLowerCase().replace(/^www\./, ''); if (sd === cd || (si.url || '').toLowerCase().includes(cd)) { position = item.rank_absolute || item.rank_group || 1; isRanked = true; break; } } if (isRanked) break; }
        }
      }
      results.push({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, is_ranked: isRanked, current_rank: position });
    }
    for (let i = 10; i < keywords.length; i++) results.push({ keyword: keywords[i].keyword, volume: keywords[i].volume, difficulty: keywords[i].difficulty, is_ranked: false, current_rank: 'Non classé' });
  } catch (e) { console.error('❌ SERP error:', e); return keywords.map(kw => ({ ...kw, is_ranked: false, current_rank: 'Non classé' })); }
  return results;
}

async function fetchRankedKeywords(domain: string, locationCode: number, langCode: string) {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;
  const cd = domain.replace(/^www\./, '');
  try {
    const r = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
      method: 'POST', headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ target: cd, location_code: locationCode, language_code: langCode, limit: 100, order_by: ['keyword_data.keyword_info.search_volume,desc'], filters: ['keyword_data.keyword_info.search_volume', '>', '0'] }]),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) { await r.text(); return null; }
    trackPaidApiCall('strategic-market', 'dataforseo', 'labs/ranked_keywords');
    const data = await r.json(); const tr = data.tasks?.[0]?.result?.[0];
    if (!tr?.items || tr.items.length === 0) return null;
    const items = tr.items; const totalCount = tr.total_count || items.length;
    const dist = { top3: 0, top10: 0, top20: 0, top50: 0, top100: 0, beyond100: 0 };
    let sumAll = 0, sumTop10 = 0, cTop10 = 0, totalEtv = 0;
    const topKw: any[] = [];
    for (const item of items) {
      const pos = item.ranked_serp_element?.serp_item?.rank_absolute || 999;
      const kw = item.keyword_data?.keyword || ''; const vol = item.keyword_data?.keyword_info?.search_volume || 0;
      const url = item.ranked_serp_element?.serp_item?.url || ''; const etv = item.ranked_serp_element?.serp_item?.etv || 0;
      sumAll += pos; totalEtv += etv;
      if (pos <= 3) dist.top3++; if (pos <= 10) { dist.top10++; sumTop10 += pos; cTop10++; } else if (pos <= 20) dist.top20++; else if (pos <= 50) dist.top50++; else if (pos <= 100) dist.top100++; else dist.beyond100++;
      if (topKw.length < 10) topKw.push({ keyword: kw, position: pos, volume: vol, url });
    }
    return { total_ranked_keywords: totalCount, average_position_global: items.length > 0 ? Math.round(sumAll / items.length * 10) / 10 : 0, average_position_top10: cTop10 > 0 ? Math.round(sumTop10 / cTop10 * 10) / 10 : 0, distribution: dist, top_keywords: topKw, etv: Math.round(totalEtv) };
  } catch (e) { console.error('❌ Ranked keywords error:', e); return null; }
}

function sortByStrategicRelevance(keywords: any[], seeds: string[], ctx: string) {
  if (keywords.length === 0) return keywords;
  const texts = extractMetadataTexts(ctx); const coreTerms: string[] = [];
  for (const t of texts) coreTerms.push(...cleanAndTokenize(t).filter(w => w.length > 2));
  const unique = [...new Set(coreTerms)]; const topSeeds = seeds.slice(0, 3).map(s => s.toLowerCase()); const maxVol = Math.max(...keywords.map((k: any) => k.volume), 1);
  const scored = keywords.map((kw: any) => {
    const kwl = kw.keyword.toLowerCase(); const vs = kw.volume / maxVol;
    const mt = unique.filter(t => kwl.includes(t)).length; const cms = unique.length > 0 ? Math.min(mt / Math.min(unique.length, 3), 1) : 0;
    let ss = 0; for (let i = 0; i < topSeeds.length; i++) { if (kwl.includes(topSeeds[i]) || topSeeds[i].includes(kwl)) ss = Math.max(ss, 1 - (i * 0.3)); }
    const wc = kwl.split(/\s+/).length; const sb = wc >= 2 ? 0.15 : 0;
    const fs = (cms * 0.45) + (ss * 0.25) + (vs * 0.2) + sb;
    if (fs >= 0.9 && kw.volume < 10) kw.is_nugget = true;
    return { kw, fs };
  });
  scored.sort((a: any, b: any) => b.fs - a.fs);
  return scored.map((s: any) => s.kw);
}

// ── MAIN HANDLER ──
Deno.serve(handleRequest(async (req) => {
const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { url, domain, businessContext, pageContentContext } = await req.json();
    if (!url || !domain) return json({ error: 'url and domain required' }, 400);

    const ck = cacheKey('strategic-market', { domain: domain.replace(/^www\./, '') });
    const cached = await getCached(ck);
    if (cached) { console.log(`⚡ [strategic-market] Cache hit`); return json({ success: true, cached: true, data: cached }); }

    const startTime = Date.now();
    const ctx = businessContext || {};
    const locationCode = ctx.locationCode || 2250;
    const languageCode = ctx.languageCode || 'fr';
    const seDomain = ctx.seDomain || 'google.fr';
    const brandName = ctx.brandName || domain.split('.')[0];
    const sector = ctx.sector || '';

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return json({ success: true, data: { marketData: null, rankingOverview: null } });

    // ── Parallel: seeds + ranked keywords ──
    const [seedsResult, rkOverview] = await Promise.all([
      (async () => {
        let seeds = await generateSeedsWithAI(url, pageContentContext || '', brandName, 'initial');
        if (seeds.length < 5) seeds = generateSeedKeywords(brandName, sector, pageContentContext || '', domain);
        let kwData = await fetchKeywordData(seeds, locationCode, languageCode);
        if (kwData.length < 3 || (kwData.reduce((s, k) => s + k.volume, 0) / Math.max(kwData.length, 1)) < 100) {
          const feedback = `Volume moyen: ${kwData.length > 0 ? (kwData.reduce((s, k) => s + k.volume, 0) / kwData.length).toFixed(0) : '0'}. Reformule avec des expressions plus populaires.`;
          const refined = await generateSeedsWithAI(url, pageContentContext || '', brandName, 'initial', feedback);
          if (refined.length >= 5) { const rd = await fetchKeywordData(refined, locationCode, languageCode); if (rd.length > kwData.length || (rd.length > 0 && rd.reduce((s, k) => s + k.volume, 0) > kwData.reduce((s, k) => s + k.volume, 0))) { kwData = rd; seeds = refined; } }
        }
        if (kwData.length === 0) return { marketData: null, seeds };
        const ranked = await checkRankings(kwData, domain, locationCode, languageCode, seDomain);
        const strategic = sortByStrategicRelevance(ranked, seeds, pageContentContext || '');
        // Guarantee min 5
        if (strategic.length < 5) { const ex = new Set(strategic.map((k: any) => k.keyword.toLowerCase())); for (const s of seeds) { if (strategic.length >= 5) break; if (s.length > 3 && !ex.has(s.toLowerCase())) { ex.add(s.toLowerCase()); strategic.push({ keyword: s, volume: 0, difficulty: 0, is_ranked: false, current_rank: 'Non classé' }); } } }
        const totalVol = strategic.reduce((s: number, k: any) => s + k.volume, 0);
        return { marketData: { location_used: ctx.location || 'France', total_market_volume: totalVol, top_keywords: strategic, data_source: 'dataforseo', fetch_timestamp: new Date().toISOString() }, seeds };
      })(),
      fetchRankedKeywords(domain, locationCode, languageCode),
    ]);

    const result = { marketData: seedsResult.marketData, rankingOverview: rkOverview, duration_ms: Date.now() - startTime };
    await setCache(ck, 'strategic-market', result, 1440);
    console.log(`✅ [strategic-market] Done in ${result.duration_ms}ms`);
    return json({ success: true, cached: false, data: result });
  } catch (error) {
    console.error('❌ [strategic-market] Fatal:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
}));