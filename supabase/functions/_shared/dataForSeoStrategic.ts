/**
 * DataForSEO strategic functions for keyword research, rankings, and competitor discovery.
 * Extracted from audit-strategique-ia to reduce monolith size.
 */

import { trackTokenUsage, trackPaidApiCall } from './tokenTracker.ts';
import {
  STOP_WORDS, cleanAndTokenize, extractMetadataTexts, buildDomainSlugs,
  type KeywordData, type MarketData, type RankingOverview, type BusinessContext,
  KNOWN_LOCATIONS, extractCoreBusiness,
} from './textUtils.ts';

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

function getAuthHeader(): string {
  return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;
}

// ==================== KEYWORD EXTRACTION ====================

function extractKeywordsFromMetadata(pageContentContext: string, domain: string = ''): string[] {
  const extracted: string[] = [];
  const texts = extractMetadataTexts(pageContentContext);
  const domainSlugs = buildDomainSlugs(domain);
  for (const text of texts) {
    const words = cleanAndTokenize(text, domainSlugs).filter(w => w.length > 2);
    for (let i = 0; i < words.length - 2; i++) {
      extracted.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    for (let i = 0; i < words.length - 1; i++) {
      extracted.push(`${words[i]} ${words[i + 1]}`);
    }
    for (const word of words) {
      if (word.length >= 5) extracted.push(word);
    }
  }
  return [...new Set(extracted)].slice(0, 12);
}

export function generateSeedKeywords(brandName: string, sector: string, pageContentContext: string = '', domain: string = ''): string[] {
  const keywords: string[] = [];
  if (pageContentContext) {
    const texts = extractMetadataTexts(pageContentContext);
    const domainSlugs = buildDomainSlugs(domain);
    const coreBigrams: string[] = [];
    for (const text of texts) {
      const words = cleanAndTokenize(text, domainSlugs);
      for (let i = 0; i < words.length - 1; i++) {
        coreBigrams.push(`${words[i]} ${words[i + 1]}`);
      }
    }
    for (const bg of coreBigrams.slice(0, 3)) {
      if (bg.length > 4 && !keywords.includes(bg)) keywords.push(bg);
    }
    const metaKeywords = extractKeywordsFromMetadata(pageContentContext, domain);
    for (const mk of metaKeywords) {
      if (mk.length > 4 && !keywords.includes(mk)) keywords.push(mk);
    }
  }
  const cleanBrand = brandName.toLowerCase().trim();
  if (sector.toLowerCase() !== cleanBrand && sector.length > 3) {
    if (!keywords.some(k => k.includes(sector))) keywords.push(sector);
  }
  if (!keywords.includes(cleanBrand)) keywords.push(cleanBrand);
  console.log(`🔑 Seed keywords (core business first): ${keywords.slice(0, 5).join(', ')}`);
  return keywords.filter(kw => kw.length > 3 && !kw.includes('undefined')).slice(0, 10);
}

// ==================== AI-DRIVEN SEED GENERATION ====================

export async function generateSeedsWithAI(
  url: string, pageContentContext: string, brandName: string,
  mode: 'initial' | 'vertical' | 'horizontal' = 'initial', feedback?: string
): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('⚠️ No AI key for seed generation, falling back to metadata extraction');
    return [];
  }

  const modeInstructions: Record<string, string> = {
    initial: "Services principaux + intentions d'achat/conversion. Ex: 'devis rénovation salle de bain', 'plombier urgence Paris', 'logiciel facturation auto-entrepreneur'.",
    vertical: "Sous-catégories techniques, longue traîne, conversion locale. Creuse en PROFONDEUR les niches métier spécifiques.",
    horizontal: "Étapes AMONT du parcours client (financement, permis, diagnostic, comparatif) et besoins CONNEXES.",
  };

  const prompt = `Tu es un Senior SEO Strategist spécialisé en recherche de mots-clés à forte intention.

ANALYSE cette page web:
URL: ${url}
${pageContentContext}

RÈGLE D'OR ABSOLUE: NE CITE JAMAIS le nom de la marque "${brandName}" ni aucune variante dans tes mots-clés. Les mots-clés doivent être 100% GÉNÉRIQUES.

MODE: ${mode.toUpperCase()}
${modeInstructions[mode]}
${feedback ? `\n⚠️ FEEDBACK: Les seeds précédents ont donné de mauvais résultats (volume trop faible ou hors-sujet). ${feedback}. Reformule avec des expressions plus recherchées et plus spécifiques.` : ''}

INSTRUCTIONS:
1. Identifie le CORE BUSINESS exact de cette entreprise
2. Génère exactement 15 mots-clés que des clients potentiels taperaient dans Google
3. Chaque mot-clé = expression de 2-5 mots à forte intention commerciale ou informationnelle
4. Privilégie les requêtes transactionnelles ("devis X", "prix X", "X pas cher") et décisionnelles ("meilleur X", "comparatif X", "avis X")
5. Inclus au moins 3 requêtes longue traîne (4-5 mots)

Réponds UNIQUEMENT avec un JSON: {"core_business": "description courte", "seeds": ["mot clé 1", "mot clé 2", ...]}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash-lite', messages: [{ role: 'user', content: prompt }], temperature: 0.5 }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) { console.log(`⚠️ AI seed generation failed: ${response.status}`); await response.text(); return []; }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    trackTokenUsage('generate-seeds', 'google/gemini-2.5-flash-lite', data.usage, url);

    let seeds: string[] = [];
    try {
      let jsonStr = content;
      if (content.includes('```json')) jsonStr = content.split('```json')[1].split('```')[0].trim();
      else if (content.includes('```')) jsonStr = content.split('```')[1].split('```')[0].trim();
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      const parsed = JSON.parse(jsonStr);
      seeds = (parsed.seeds || parsed.keywords || []).filter((s: string) => typeof s === 'string' && s.length > 3);
      if (parsed.core_business) console.log(`🎯 AI Core Business: "${parsed.core_business}"`);
    } catch {
      const match = content.match(/\[([^\]]+)\]/);
      if (match) {
        seeds = match[1].split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter((s: string) => s.length > 3);
      }
    }

    const brandLower = brandName.toLowerCase();
    const domainSlug = brandLower.replace(/\s+/g, '');
    seeds = seeds.filter(s => {
      const sLower = s.toLowerCase();
      return !sLower.includes(brandLower) && !sLower.includes(domainSlug);
    });

    console.log(`🤖 AI seeds (${mode}): ${seeds.slice(0, 8).join(', ')}... (${seeds.length} total)`);
    return seeds.slice(0, 15);
  } catch (error) {
    console.error('❌ AI seed generation error:', error);
    return [];
  }
}

// ==================== KEYWORD DATA FETCHING ====================

function checkDataQuality(keywords: { keyword: string; volume: number; difficulty: number }[]): boolean {
  if (keywords.length < 3) return false;
  const avgVolume = keywords.reduce((sum, kw) => sum + kw.volume, 0) / keywords.length;
  if (avgVolume < 100) return false;
  return true;
}

async function fetchKeywordData(
  seedKeywords: string[], locationCode: number, languageCode: string = 'fr'
): Promise<{ keyword: string; volume: number; difficulty: number }[]> {
  console.log(`📊 Récupération mots-clés pour location: ${locationCode}, lang: ${languageCode}`);
  const allKeywords: { keyword: string; volume: number; difficulty: number }[] = [];
  const seenLower = new Set<string>();
  const addUnique = (kw: { keyword: string; volume: number; difficulty: number }) => {
    const lower = kw.keyword.toLowerCase();
    if (!seenLower.has(lower) && kw.volume >= 0) { seenLower.add(lower); allKeywords.push(kw); }
  };

  try {
    // Phase 1: keywords_for_keywords
    const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
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
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
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

    // Phase 3: broader expansion
    if (allKeywords.length < 5 && seedKeywords.length > 0) {
      console.log('🔄 Phase 3: broader single-word expansion...');
      const singleWords = seedKeywords.flatMap(s => s.split(/\s+/)).filter(w => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase())).slice(0, 5);
      if (singleWords.length > 0) {
        const broadResponse = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
          method: 'POST',
          headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
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
  } catch (error) {
    console.error('❌ Erreur mots-clés:', error);
  }
  return allKeywords.sort((a, b) => b.volume - a.volume).slice(0, 15);
}

// ==================== RANKING CHECK ====================

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
    const tasks = keywordsToCheck.map(kw => ({
      keyword: kw.keyword, location_code: locationCode, language_code: languageCode, depth: 50, se_domain: seDomain,
    }));
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
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
            console.log(`🎯 ${kw.keyword}: ${cleanDomain} trouvé pos ${position} (type: ${item.type})`);
            break;
          }
          if (item.items && Array.isArray(item.items)) {
            for (const subItem of item.items) {
              const subDomain = (subItem.domain || '').toLowerCase().replace(/^www\./, '');
              const subUrl = (subItem.url || '').toLowerCase();
              if (subDomain === cleanDomain || subUrl.includes(cleanDomain)) {
                position = item.rank_absolute || item.rank_group || 1;
                isRanked = true;
                break;
              }
            }
            if (isRanked) break;
          }
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

// ==================== STRATEGIC RELEVANCE SORT ====================

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
      if (kwLower.includes(topSeeds[i]) || topSeeds[i].includes(kwLower)) { seedScore = Math.max(seedScore, 1 - (i * 0.3)); }
    }
    const wordCount = kwLower.split(/\s+/).length;
    const specificityBonus = wordCount >= 2 ? 0.15 : 0;
    const finalScore = (coreMatchScore * 0.45) + (seedScore * 0.25) + (volumeScore * 0.2) + specificityBonus;
    return { kw, finalScore, coreMatchScore, seedScore };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  console.log(`🏆 Top 3 strategic keywords: ${scored.slice(0, 3).map(s => `"${s.kw.keyword}" (relevance: ${(s.finalScore * 100).toFixed(0)}%)`).join(' | ')}`);

  for (const s of scored) {
    if (s.finalScore >= 0.9 && s.kw.volume < 10) {
      s.kw.is_nugget = true;
      console.log(`💎 Pépite détectée: "${s.kw.keyword}"`);
    }
  }
  return scored.map(s => s.kw);
}

// ==================== MARKET DATA (FULL PIPELINE) ====================

export async function fetchMarketData(domain: string, context: BusinessContext, pageContentContext: string = '', url: string = ''): Promise<MarketData | null> {
  console.log('🚀 Collecte DataForSEO pour:', domain);
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD || !context.locationCode) {
    console.log('⚠️ DataForSEO non disponible');
    return null;
  }

  try {
    let seedKeywords: string[] = [];
    const effectiveUrl = url || `https://${domain}`;
    const aiSeeds = await generateSeedsWithAI(effectiveUrl, pageContentContext, context.brandName, 'initial');
    if (aiSeeds.length >= 5) {
      seedKeywords = aiSeeds;
    } else {
      seedKeywords = generateSeedKeywords(context.brandName, context.sector, pageContentContext, domain);
    }
    console.log('🌱 Seeds finaux:', seedKeywords.slice(0, 8).join(', '));

    let keywordData = await fetchKeywordData(seedKeywords, context.locationCode, context.languageCode);

    // Retry if poor quality
    if (!checkDataQuality(keywordData) && aiSeeds.length > 0) {
      console.log('🔄 Data quality check failed — retrying...');
      const avgVol = keywordData.length > 0 ? (keywordData.reduce((s, k) => s + k.volume, 0) / keywordData.length).toFixed(0) : '0';
      const feedback = `Volume moyen: ${avgVol}. Seulement ${keywordData.length} résultats.`;
      const refinedSeeds = await generateSeedsWithAI(effectiveUrl, pageContentContext, context.brandName, 'initial', feedback);
      if (refinedSeeds.length >= 5) {
        const refinedData = await fetchKeywordData(refinedSeeds, context.locationCode, context.languageCode);
        if (refinedData.length > keywordData.length || (refinedData.length > 0 && refinedData.reduce((s, k) => s + k.volume, 0) > keywordData.reduce((s, k) => s + k.volume, 0))) {
          keywordData = refinedData;
          seedKeywords = refinedSeeds;
        }
      }
    }

    if (keywordData.length === 0) return null;

    const rankedKeywords = await checkRankings(keywordData, domain, context.locationCode, context.languageCode, context.seDomain);
    const strategicKeywords = sortByStrategicRelevance(rankedKeywords, seedKeywords, pageContentContext);

    // Guarantee minimum 5 keywords
    if (strategicKeywords.length < 5) {
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
    return {
      location_used: context.location, total_market_volume: totalVolume,
      top_keywords: strategicKeywords, data_source: 'dataforseo', fetch_timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Erreur DataForSEO:', error);
    return null;
  }
}

// ==================== RANKED KEYWORDS ====================

export async function fetchRankedKeywords(domain: string, locationCode: number, languageCode: string = 'fr'): Promise<RankingOverview | null> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;
  const cleanDomain = domain.replace(/^www\./, '');
  console.log(`📊 Fetching ranked keywords for ${cleanDomain}...`);

  try {
    const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        target: cleanDomain, location_code: locationCode, language_code: languageCode,
        limit: 100, order_by: ['keyword_data.keyword_info.search_volume,desc'],
        filters: ['keyword_data.keyword_info.search_volume', '>', '0'],
      }]),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { await response.text(); return null; }
    trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'labs/ranked_keywords');
    const data = await response.json();
    const taskResult = data.tasks?.[0]?.result?.[0];
    if (!taskResult?.items || taskResult.items.length === 0) return null;

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
      sumPositionAll += pos;
      totalEtv += etv;
      if (pos <= 3) distribution.top3++;
      if (pos <= 10) { distribution.top10++; sumPositionTop10 += pos; countTop10++; }
      else if (pos <= 20) distribution.top20++;
      else if (pos <= 50) distribution.top50++;
      else if (pos <= 100) distribution.top100++;
      else distribution.beyond100++;
      if (topKeywords.length < 10) topKeywords.push({ keyword: kw, position: pos, volume: vol, url });
    }

    const overview: RankingOverview = {
      total_ranked_keywords: totalCount,
      average_position_global: items.length > 0 ? Math.round(sumPositionAll / items.length * 10) / 10 : 0,
      average_position_top10: countTop10 > 0 ? Math.round(sumPositionTop10 / countTop10 * 10) / 10 : 0,
      distribution, top_keywords: topKeywords, etv: Math.round(totalEtv),
    };
    console.log(`✅ Ranking overview: ${totalCount} keywords, avg pos=${overview.average_position_global}, ETV=${overview.etv}`);
    return overview;
  } catch (error) {
    console.error('❌ Ranked keywords error:', error);
    return null;
  }
}

// ==================== COMPETITOR DISCOVERY ====================

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

function isNonCompetitorDomain(domain: string): boolean {
  const clean = domain.replace(/^www\./, '').toLowerCase();
  if (NON_COMPETITOR_DOMAINS.has(clean)) return true;
  const parts = clean.split('.');
  if (parts.length > 2) {
    const root = parts.slice(-2).join('.');
    if (NON_COMPETITOR_DOMAINS.has(root)) return true;
  }
  return false;
}

export async function findLocalCompetitor(
  domain: string, sector: string, locationCode: number, pageContentContext: string,
  languageCode: string = 'fr', seDomain: string = 'google.fr',
  siteContext?: Record<string, unknown> | null,
): Promise<{ name: string; url: string; rank: number; score?: number }[] | null> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;

  // Identity card competitors
  if (siteContext?.competitors && Array.isArray(siteContext.competitors) && (siteContext.competitors as string[]).length > 0) {
    console.log(`🎯 Concurrents connus (carte d'identité): ${(siteContext.competitors as string[]).join(', ')}`);
    return (siteContext.competitors as string[]).slice(0, 3).map((c: string, i: number) => ({ name: c, url: '', rank: 0, score: 100 - i }));
  }

  const businessType = (siteContext?.business_type as string) || '';
  const brandName = (siteContext?.brand_name as string) || '';
  const commercialArea = (siteContext?.commercial_area as string) || '';
  const gmb = siteContext?.gmb_presence === true;
  const gmbCity = (siteContext?.gmb_city as string) || '';
  const productsServices = (siteContext?.products_services as string) || '';

  let city = gmbCity || commercialArea || '';
  if (!city && pageContentContext) {
    const cityPatterns = [/(?:à|a|en|sur)\s+([A-ZÀ-Ü][a-zà-ü]+(?:[-\s][A-ZÀ-Ü][a-zà-ü]+)*)/g, /([A-ZÀ-Ü][a-zà-ü]+(?:[-\s][A-ZÀ-Ü][a-zà-ü]+)*)\s*(?:\d{5})/g];
    for (const pattern of cityPatterns) {
      const match = pattern.exec(pageContentContext);
      if (match?.[1] && match[1].length > 2 && match[1].length < 30) { city = match[1]; break; }
    }
  }

  const sectorWords = sector.split(' ').filter(w => w.length > 2).slice(0, 3).join(' ');
  const productWords = productsServices ? productsServices.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 2)[0] || '' : '';

  const queries: string[] = [];
  switch (businessType.toLowerCase()) {
    case 'local': case 'artisan':
      queries.push(city ? `${productWords || sectorWords} ${city}` : sectorWords);
      if (gmb && gmbCity) queries.push(`${sectorWords} ${gmbCity} avis`);
      break;
    case 'e-commerce': case 'ecommerce':
      queries.push(`${productWords || sectorWords} acheter en ligne`);
      if (brandName) queries.push(`${brandName} alternative`);
      break;
    case 'saas':
      queries.push(brandName ? `${brandName} alternative` : `${sectorWords} logiciel`);
      queries.push(`meilleur ${sectorWords} outil`);
      break;
    case 'media': case 'blog':
      queries.push(`${sectorWords} blog référence`);
      break;
    default:
      queries.push(city ? `${sectorWords} ${city}` : sectorWords);
      if (brandName) queries.push(`${brandName} vs`);
      break;
  }

  const uniqueQueries = [...new Set(queries.filter(q => q.trim().length > 3))].slice(0, 2);
  console.log(`🏙️ Recherche concurrents (${businessType || 'auto'}): ${uniqueQueries.map(q => `"${q}"`).join(', ')}`);

  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  const isValidCompetitor = (item: any) => {
    const d = item.domain.toLowerCase().replace(/^www\./, '');
    if (d.includes(cleanDomain) || cleanDomain.includes(d)) return false;
    if (isNonCompetitorDomain(d)) return false;
    return true;
  };

  const scoreMap = new Map<string, { name: string; url: string; rank: number; score: number }>();

  try {
    for (const query of uniqueQueries) {
      const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
        method: 'POST',
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keyword: query, location_code: locationCode, language_code: languageCode, depth: 20, se_domain: seDomain }]),
      });
      if (!response.ok) { await response.text(); continue; }
      trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'serp/organic/competitor');
      const data = await response.json();
      const items = data.tasks?.[0]?.result?.[0]?.items;
      if (!items || !Array.isArray(items)) continue;
      const organicResults = items.filter((item: any) => item.type === 'organic' && item.domain && item.url);
      for (const item of organicResults) {
        if (!isValidCompetitor(item)) continue;
        const d = item.domain.toLowerCase().replace(/^www\./, '');
        const existing = scoreMap.get(d);
        const rankScore = Math.max(0, 21 - (item.rank_absolute || item.rank_group || 20));
        if (existing) { existing.score += rankScore + 10; }
        else { scoreMap.set(d, { name: item.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || item.domain, url: item.url, rank: item.rank_absolute || item.rank_group || 0, score: rankScore }); }
      }
    }

    if (scoreMap.size === 0) return null;
    const sorted = [...scoreMap.values()].sort((a, b) => b.score - a.score).slice(0, 3);
    console.log(`✅ Top concurrents: ${sorted.map(c => `"${c.name}" (score:${c.score})`).join(', ')}`);
    return sorted;
  } catch (error) {
    console.error('❌ Erreur recherche concurrents:', error);
    return null;
  }
}
