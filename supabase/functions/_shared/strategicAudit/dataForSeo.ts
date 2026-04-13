/**
 * DataForSEO API interactions: keyword data, rankings, market data, ranked keywords overview.
 */
import { trackPaidApiCall } from '../tokenTracker.ts';
import { cleanAndTokenize, extractMetadataTexts, STOP_WORDS } from './textUtils.ts';
import { generateSeedKeywords, generateSeedsWithAI } from './businessContext.ts';
import type { KeywordData, MarketData, RankingOverview, BusinessContext } from './types.ts';

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

export function getDataForSeoAuthHeader(): string {
  return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;
}

export function hasDataForSeoCredentials(): boolean {
  return !!(DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD);
}

export function checkDataQuality(keywords: { keyword: string; volume: number; difficulty: number }[]): boolean {
  if (keywords.length < 3) return false;
  const avgVolume = keywords.reduce((sum, kw) => sum + kw.volume, 0) / keywords.length;
  return avgVolume >= 100;
}

// Domains that are NEVER real product competitors
const NON_COMPETITOR_DOMAINS = new Set([
  'forbes.com', 'forbes.fr', 'lemonde.fr', 'lefigaro.fr', 'bfmtv.com', 'lesechos.fr',
  'wikipedia.org', 'fr.wikipedia.org', 'en.wikipedia.org',
  'youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'reddit.com', 'tiktok.com', 'pinterest.com',
  'amazon.com', 'amazon.fr', 'ebay.fr', 'ebay.com', 'aliexpress.com', 'cdiscount.com',
  'trustpilot.com', 'glassdoor.fr', 'glassdoor.com', 'indeed.fr', 'indeed.com',
  'capterra.fr', 'capterra.com', 'g2.com', 'getapp.com', 'appvizer.fr', 'appvizer.com',
  'societe.com', 'pappers.fr', 'pagesjaunes.fr', 'yelp.fr', 'yelp.com',
  'journaldunet.com', 'journaldunet.fr', 'commentcamarche.net', 'linternaute.com',
  'medium.com', 'substack.com', 'hubspot.com', 'hubspot.fr', 'salesforce.com',
  'crunchbase.com', 'wellfound.com', 'producthunt.com',
  'google.com', 'google.fr', 'apple.com', 'microsoft.com', 'github.com',
]);

export function isNonCompetitorDomain(domain: string): boolean {
  const clean = domain.replace(/^www\./, '').toLowerCase();
  if (NON_COMPETITOR_DOMAINS.has(clean)) return true;
  const parts = clean.split('.');
  if (parts.length > 2) {
    const root = parts.slice(-2).join('.');
    if (NON_COMPETITOR_DOMAINS.has(root)) return true;
  }
  return false;
}

export async function fetchKeywordData(
  seedKeywords: string[], locationCode: number, languageCode: string = 'fr'
): Promise<{ keyword: string; volume: number; difficulty: number }[]> {
  console.log(`📊 Récupération mots-clés pour location: ${locationCode}, lang: ${languageCode}`);
  const allKeywords: { keyword: string; volume: number; difficulty: number }[] = [];
  const seenLower = new Set<string>();
  const addUnique = (kw: { keyword: string; volume: number; difficulty: number }) => {
    const lower = kw.keyword.toLowerCase();
    if (!seenLower.has(lower) && kw.volume >= 0) { seenLower.add(lower); allKeywords.push(kw); }
  };
  const authHeader = getDataForSeoAuthHeader();

  try {
    // Phase 1: keywords_for_keywords
    const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keywords: seedKeywords.slice(0, 5), location_code: locationCode, language_code: languageCode, sort_by: 'search_volume', include_adult_keywords: false }]),
    });
    if (response.ok) {
      trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'keywords_for_keywords');
      const data = await response.json();
      if (data.status_code === 20000 && data.tasks?.[0]?.result) {
        for (const item of data.tasks[0].result) {
          if (item.keyword && item.search_volume >= 0) {
            addUnique({ keyword: item.keyword, volume: item.search_volume || 0, difficulty: item.competition_index || Math.round((item.competition || 0.3) * 100) });
          }
        }
        console.log(`✅ ${allKeywords.length} mots-clés via Google Ads API`);
      }
    } else { await response.text(); }

    // Phase 2: search_volume fallback
    if (allKeywords.length < 10) {
      console.log('🔄 Fallback: search_volume...');
      const volumeResponse = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keywords: seedKeywords, location_code: locationCode, language_code: languageCode }]),
      });
      if (volumeResponse.ok) {
        const volumeData = await volumeResponse.json();
        if (volumeData.status_code === 20000 && volumeData.tasks?.[0]?.result) {
          for (const item of volumeData.tasks[0].result) {
            if (item.keyword && item.search_volume >= 0) {
              addUnique({ keyword: item.keyword, volume: item.search_volume || 0, difficulty: item.competition ? Math.round(item.competition * 100) : 30 });
            }
          }
        }
      } else { await volumeResponse.text(); }
    }

    // Phase 3: broader single-word expansion
    if (allKeywords.length < 5 && seedKeywords.length > 0) {
      console.log('🔄 Phase 3: broader single-word expansion...');
      const singleWords = seedKeywords.flatMap(s => s.split(/\s+/)).filter(w => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase())).slice(0, 5);
      if (singleWords.length > 0) {
        const broadResponse = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
          method: 'POST',
          headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keywords: singleWords, location_code: locationCode, language_code: languageCode, sort_by: 'search_volume', include_adult_keywords: false }]),
        });
        if (broadResponse.ok) {
          const broadData = await broadResponse.json();
          if (broadData.status_code === 20000 && broadData.tasks?.[0]?.result) {
            for (const item of broadData.tasks[0].result) {
              if (item.keyword && item.search_volume >= 0) {
                addUnique({ keyword: item.keyword, volume: item.search_volume || 0, difficulty: item.competition_index || Math.round((item.competition || 0.3) * 100) });
              }
            }
            console.log(`✅ Phase 3: ${allKeywords.length} mots-clés total après expansion`);
          }
        } else { await broadResponse.text(); }
      }
    }
  } catch (error) { console.error('❌ Erreur mots-clés:', error); }
  return allKeywords.sort((a, b) => b.volume - a.volume).slice(0, 15);
}

export async function checkRankings(
  keywords: { keyword: string; volume: number; difficulty: number }[],
  domain: string, locationCode: number, languageCode: string = 'fr', seDomain: string = 'google.fr'
): Promise<KeywordData[]> {
  console.log(`📈 Vérification positionnement pour ${domain}`);
  const results: KeywordData[] = [];
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  const EXCLUDED_TYPES = new Set(['paid', 'ads']);
  const keywordsToCheck = keywords.slice(0, 10);

  try {
    const tasks = keywordsToCheck.map(kw => ({ keyword: kw.keyword, location_code: locationCode, language_code: languageCode, depth: 50, se_domain: seDomain }));
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getDataForSeoAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    });
    if (!response.ok) { await response.text(); return keywords.map(kw => ({ ...kw, is_ranked: false, current_rank: 'Non classé' })); }
    trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'serp/organic');
    const data = await response.json();

    for (let i = 0; i < keywordsToCheck.length; i++) {
      const kw = keywordsToCheck[i];
      const taskResult = data.tasks?.[i]?.result?.[0];
      let position: number | string = 'Non classé';
      let isRanked = false;
      if (taskResult?.items) {
        for (const item of taskResult.items) {
          if (EXCLUDED_TYPES.has(item.type)) continue;
          const itemDomain = (item.domain || '').toLowerCase().replace(/^www\./, '');
          const itemUrl = (item.url || '').toLowerCase();
          const domainMatch = itemDomain && (itemDomain === cleanDomain || itemDomain.endsWith('.' + cleanDomain) || cleanDomain.endsWith('.' + itemDomain));
          const urlMatch = itemUrl.includes(cleanDomain);
          if (domainMatch || urlMatch) {
            position = item.rank_absolute || item.rank_group || 1;
            isRanked = true;
            console.log(`🎯 ${kw.keyword}: ${cleanDomain} trouvé pos ${position} (type: ${item.type}, domain: ${itemDomain})`);
            break;
          }
          if (item.items && Array.isArray(item.items)) {
            for (const subItem of item.items) {
              const subDomain = (subItem.domain || '').toLowerCase().replace(/^www\./, '');
              const subUrl = (subItem.url || '').toLowerCase();
              if (subDomain === cleanDomain || subUrl.includes(cleanDomain)) { position = item.rank_absolute || item.rank_group || 1; isRanked = true; break; }
            }
            if (isRanked) break;
          }
        }
        if (!isRanked) {
          const itemTypes = taskResult.items.slice(0, 8).map((it: any) => `${it.type}:${(it.domain||'').replace(/^www\./,'')}`).join(', ');
          console.log(`❌ ${kw.keyword}: ${cleanDomain} non trouvé dans ${taskResult.items.length} items [${itemTypes}]`);
        }
      }
      results.push({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, is_ranked: isRanked, current_rank: position });
    }
    for (let i = 10; i < keywords.length; i++) {
      results.push({ keyword: keywords[i].keyword, volume: keywords[i].volume, difficulty: keywords[i].difficulty, is_ranked: false, current_rank: 'Non classé' });
    }
    console.log(`✅ Positionnement: ${results.filter(r => r.is_ranked).length}/${results.length} classés`);
  } catch (error) {
    console.error('❌ Erreur SERP:', error);
    return keywords.map(kw => ({ ...kw, is_ranked: false, current_rank: 'Non classé' }));
  }
  return results;
}

export function sortByStrategicRelevance(keywords: KeywordData[], seedKeywords: string[], pageContentContext: string): KeywordData[] {
  if (keywords.length === 0) return keywords;
  const texts = extractMetadataTexts(pageContentContext);
  const coreTerms: string[] = [];
  for (const text of texts) { coreTerms.push(...cleanAndTokenize(text).filter(w => w.length > 2)); }
  const uniqueCoreTerms = [...new Set(coreTerms)];
  const topSeeds = seedKeywords.slice(0, 3).map(s => s.toLowerCase());
  const maxVolume = Math.max(...keywords.map(kw => kw.volume), 1);

  const scored = keywords.map(kw => {
    const kwLower = kw.keyword.toLowerCase();
    const volumeScore = kw.volume / maxVolume;
    const matchingCoreTerms = uniqueCoreTerms.filter(t => kwLower.includes(t)).length;
    const coreMatchScore = uniqueCoreTerms.length > 0 ? Math.min(matchingCoreTerms / Math.min(uniqueCoreTerms.length, 3), 1) : 0;
    let seedScore = 0;
    for (let i = 0; i < topSeeds.length; i++) {
      if (kwLower.includes(topSeeds[i]) || topSeeds[i].includes(kwLower)) seedScore = Math.max(seedScore, 1 - (i * 0.3));
    }
    const wordCount = kwLower.split(/\s+/).length;
    const specificityBonus = wordCount >= 2 ? 0.15 : 0;
    const finalScore = (coreMatchScore * 0.45) + (seedScore * 0.25) + (volumeScore * 0.2) + specificityBonus;
    return { kw, finalScore, coreMatchScore, seedScore };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  console.log(`🏆 Top 3 strategic keywords: ${scored.slice(0, 3).map(s => `"${s.kw.keyword}" (relevance: ${(s.finalScore * 100).toFixed(0)}%, core: ${(s.coreMatchScore * 100).toFixed(0)}%, seed: ${(s.seedScore * 100).toFixed(0)}%)`).join(' | ')}`);

  for (const s of scored) {
    if (s.finalScore >= 0.9 && s.kw.volume < 10) {
      s.kw.is_nugget = true;
      console.log(`💎 Pépite détectée: "${s.kw.keyword}" (relevance: ${(s.finalScore * 100).toFixed(0)}%, volume: ${s.kw.volume})`);
    }
  }
  return scored.map(s => s.kw);
}

export async function fetchMarketData(domain: string, context: BusinessContext, pageContentContext: string = '', url: string = '', existingKeywords: string[] = []): Promise<MarketData | null> {
  console.log('🚀 Collecte DataForSEO pour:', domain);
  if (!hasDataForSeoCredentials() || !context.locationCode) { console.log('⚠️ DataForSEO non disponible'); return null; }

  try {
    let seedKeywords: string[] = [];
    let aiSeeds: string[] = [];
    const effectiveUrl = url || `https://${domain}`;

    if (existingKeywords.length >= 5) {
      seedKeywords = existingKeywords.slice(0, 15);
      console.log(`☁️ Using existing keyword cloud as seeds (${seedKeywords.length} terms)`);
    } else {
      aiSeeds = await generateSeedsWithAI(effectiveUrl, pageContentContext, context.brandName, 'initial');
      if (aiSeeds.length >= 5) { seedKeywords = aiSeeds; console.log(`✅ AI-driven seeds: ${seedKeywords.length} keywords`); }
      else { console.log('⚠️ AI seeds insufficient, falling back to metadata extraction'); seedKeywords = generateSeedKeywords(context.brandName, context.sector, pageContentContext, domain); }
    }
    console.log('🌱 Seeds finaux:', seedKeywords.slice(0, 8).join(', '));

    let keywordData = await fetchKeywordData(seedKeywords, context.locationCode, context.languageCode);

    if (!checkDataQuality(keywordData) && aiSeeds.length > 0) {
      console.log('🔄 Data quality check failed — retrying with refined seeds...');
      const avgVol = keywordData.length > 0 ? (keywordData.reduce((s, k) => s + k.volume, 0) / keywordData.length).toFixed(0) : '0';
      const feedback = `Volume moyen: ${avgVol}. Seulement ${keywordData.length} résultats. Utilise des expressions plus populaires et mainstream.`;
      const refinedSeeds = await generateSeedsWithAI(effectiveUrl, pageContentContext, context.brandName, 'initial', feedback);
      if (refinedSeeds.length >= 5) {
        const refinedData = await fetchKeywordData(refinedSeeds, context.locationCode, context.languageCode);
        if (refinedData.length > keywordData.length || (refinedData.length > 0 && refinedData.reduce((s, k) => s + k.volume, 0) > keywordData.reduce((s, k) => s + k.volume, 0))) {
          keywordData = refinedData; seedKeywords = refinedSeeds; console.log(`✅ Refined seeds produced better results: ${keywordData.length} keywords`);
        }
      }
    }

    if (keywordData.length === 0) { console.log('⚠️ Aucun mot-clé trouvé'); return null; }

    const rankedKeywords = await checkRankings(keywordData, domain, context.locationCode, context.languageCode, context.seDomain);
    const strategicKeywords = sortByStrategicRelevance(rankedKeywords, seedKeywords, pageContentContext);

    if (strategicKeywords.length < 5) {
      console.log(`⚠️ Only ${strategicKeywords.length} keywords — supplementing with seeds`);
      const existingLower = new Set(strategicKeywords.map(kw => kw.keyword.toLowerCase()));
      for (const seed of seedKeywords) {
        if (strategicKeywords.length >= 5) break;
        if (seed.length > 3 && !existingLower.has(seed.toLowerCase())) {
          existingLower.add(seed.toLowerCase());
          strategicKeywords.push({ keyword: seed, volume: 0, difficulty: 0, is_ranked: false, current_rank: 'Non classé' });
        }
      }
    }

    const totalVolume = strategicKeywords.reduce((sum, kw) => sum + kw.volume, 0);
    console.log(`✅ Données: ${strategicKeywords.length} mots-clés, volume: ${totalVolume}`);
    return { location_used: context.location, total_market_volume: totalVolume, top_keywords: strategicKeywords, data_source: 'dataforseo', fetch_timestamp: new Date().toISOString() };
  } catch (error) { console.error('❌ Erreur DataForSEO:', error); return null; }
}

export async function fetchRankedKeywords(domain: string, locationCode: number, languageCode: string = 'fr'): Promise<RankingOverview | null> {
  if (!hasDataForSeoCredentials()) return null;
  const cleanDomain = domain.replace(/^www\./, '');
  console.log(`📊 Fetching ranked keywords for ${cleanDomain}...`);

  try {
    const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
      method: 'POST',
      headers: { 'Authorization': getDataForSeoAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ target: cleanDomain, location_code: locationCode, language_code: languageCode, limit: 100, order_by: ['keyword_data.keyword_info.search_volume,desc'], filters: ['keyword_data.keyword_info.search_volume', '>', '0'] }]),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { console.log(`⚠️ Ranked keywords API error: ${response.status}`); await response.text(); return null; }
    trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'labs/ranked_keywords');

    const data = await response.json();
    const taskResult = data.tasks?.[0]?.result?.[0];
    if (!taskResult?.items || taskResult.items.length === 0) { console.log('⚠️ No ranked keywords found for domain'); return null; }

    const items = taskResult.items;
    const totalCount = taskResult.total_count || items.length;
    const distribution = { top3: 0, top10: 0, top20: 0, top50: 0, top100: 0, beyond100: 0 };
    let sumPositionAll = 0, sumPositionTop10 = 0, countTop10 = 0, totalEtv = 0;
    const topKeywords: { keyword: string; position: number; volume: number; url: string }[] = [];

    for (const item of items) {
      const pos = item.ranked_serp_element?.serp_item?.rank_absolute || item.ranked_serp_element?.serp_item?.rank_group || 999;
      const kw = item.keyword_data?.keyword || '';
      const vol = item.keyword_data?.keyword_info?.search_volume || 0;
      const url = item.ranked_serp_element?.serp_item?.url || '';
      const etv = item.ranked_serp_element?.serp_item?.etv || 0;
      sumPositionAll += pos; totalEtv += etv;
      if (pos <= 3) distribution.top3++;
      if (pos <= 10) { distribution.top10++; sumPositionTop10 += pos; countTop10++; }
      else if (pos <= 20) distribution.top20++;
      else if (pos <= 50) distribution.top50++;
      else if (pos <= 100) distribution.top100++;
      else distribution.beyond100++;
      if (topKeywords.length < 10) topKeywords.push({ keyword: kw, position: pos, volume: vol, url });
    }

    const avgGlobal = items.length > 0 ? Math.round(sumPositionAll / items.length * 10) / 10 : 0;
    const avgTop10 = countTop10 > 0 ? Math.round(sumPositionTop10 / countTop10 * 10) / 10 : 0;
    const overview: RankingOverview = { total_ranked_keywords: totalCount, average_position_global: avgGlobal, average_position_top10: avgTop10, distribution, top_keywords: topKeywords, etv: Math.round(totalEtv) };
    console.log(`✅ Ranking overview: ${totalCount} keywords, avg pos global=${avgGlobal}, top10=${avgTop10}, ETV=${overview.etv}`);
    return overview;
  } catch (error) { console.error('❌ Ranked keywords error:', error); return null; }
}
