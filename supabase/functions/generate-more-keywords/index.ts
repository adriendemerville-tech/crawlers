import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

function getAuthHeader(): string {
  const credentials = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
  return `Basic ${credentials}`;
}

interface KeywordItem {
  keyword: string;
  volume: number;
  difficulty: number;
  current_rank: number | string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { domain, existingKeywords, brandName, locationCode, siteContext } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Generating more keywords for ${domain}`);

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      return new Response(
        JSON.stringify({ error: 'DataForSEO not configured', keywords: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedBrand = brandName || extractBrandFromDomain(domain);
    const location = locationCode || 2250;

    // Build contextual filter from existing keywords to keep new ones on-topic
    const existingKws = (existingKeywords || []).map((k: any) => k.keyword?.toLowerCase() || '');
    const contextTerms = buildContextTerms(existingKws, siteContext || '');
    
    const newSeeds = generateMoreSeedKeywords(extractedBrand, existingKws, contextTerms);
    console.log(`🔍 New seed keywords: ${newSeeds.join(', ')}`);
    console.log(`🎯 Context terms for filtering: ${contextTerms.join(', ')}`);

    const newKeywords = await fetchAdditionalKeywords(newSeeds, location, existingKws, contextTerms);
    const rankedKeywords = await checkNewRankings(newKeywords, domain, location);

    console.log(`✅ Generated ${rankedKeywords.length} additional keywords`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        keywords: rankedKeywords,
        count: rankedKeywords.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error generating more keywords:', error);
    return new Response(
      JSON.stringify({ error: errorMessage, keywords: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractBrandFromDomain(domain: string): string {
  const parts = domain.toLowerCase().split('.');
  const prefixes = ['www', 'fr', 'en', 'de', 'es', 'it', 'us', 'uk', 'shop', 'store', 'm', 'mobile'];
  const tlds = ['com', 'fr', 'net', 'org', 'io', 'co', 'be', 'ch', 'de', 'es', 'it', 'uk', 'ai'];
  
  const significantParts = parts.filter(part => 
    !prefixes.includes(part) && !tlds.includes(part) && part.length > 2
  );
  
  if (significantParts.length > 0) {
    return significantParts[0].replace(/-/g, ' ');
  }
  return parts[0].replace(/-/g, ' ');
}

/**
 * Build a set of context terms from existing keywords to filter new ones.
 * This prevents homonym confusion (e.g., "LCP" the TV channel vs "LCP" the web metric).
 */
function buildContextTerms(existingKeywords: string[], siteContext: string): string[] {
  const terms = new Set<string>();
  
  // Extract meaningful words from existing keywords (the "topic DNA" of the site)
  const stopWords = new Set(['le','la','les','de','des','du','un','une','et','en','pour','par','sur','au','avec','dans','ou','plus','qui','que','est','son','sa','ses','ce','cette','pas','ne','se','très','aussi','bien','tout','tous','même','autre','site','web','page','meilleur','comparatif','outil','gratuit','avis','prix','test','alternative','vs','france']);
  
  for (const kw of existingKeywords) {
    if (!kw) continue;
    const words = kw.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    for (const w of words) terms.add(w);
  }
  
  // Also extract from site context (title, description, h1)
  if (siteContext) {
    const contextWords = siteContext.toLowerCase()
      .replace(/[^\wàâäéèêëïîôùûüÿçœæ\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    for (const w of contextWords.slice(0, 20)) terms.add(w);
  }
  
  return [...terms];
}

/**
 * Check if a keyword is contextually relevant to the site's core business.
 * Prevents homonym confusion like "LCP" (TV channel) vs "LCP" (Largest Contentful Paint).
 */
function isContextuallyRelevant(keyword: string, contextTerms: string[], brandName: string): boolean {
  if (contextTerms.length === 0) return true; // No context = accept all
  
  const kwLower = keyword.toLowerCase();
  const brand = brandName.toLowerCase();
  
  // Always accept brand-related keywords
  if (kwLower.includes(brand) || brand.includes(kwLower)) return true;
  
  // Check if any context term appears in the keyword or vice-versa
  const kwWords = kwLower.split(/\s+/);
  for (const term of contextTerms) {
    if (kwLower.includes(term) || term.includes(kwLower)) return true;
    for (const kwWord of kwWords) {
      if (kwWord.length > 3 && (kwWord === term || term.startsWith(kwWord) || kwWord.startsWith(term))) return true;
    }
  }
  
  return false;
}

function generateMoreSeedKeywords(brandName: string, existingKeywords: string[], contextTerms: string[]): string[] {
  const brand = brandName.toLowerCase().trim();
  
  const variations = [
    `${brand} avis`,
    `${brand} alternative`,
    `${brand} comparatif`,
    `${brand} test`,
    `meilleur ${brand}`,
    `${brand} vs`,
    `${brand} fonctionnalités`,
    `${brand} tutoriel`,
  ];
  
  // Build market-intent seeds from context terms (highest relevance)
  const broadeners = ['meilleur', 'comparatif', 'outil', 'logiciel', 'plateforme', 'guide'];
  for (const existing of existingKeywords.slice(0, 5)) {
    if (existing && existing.length > 3 && !existing.includes(brand)) {
      for (const prefix of broadeners.slice(0, 3)) {
        const variant = `${prefix} ${existing}`;
        if (!existingKeywords.includes(variant)) variations.push(variant);
      }
    }
  }
  
  // Also combine pairs of context terms for thematic seeds
  const topTerms = contextTerms.filter(t => t.length > 3).slice(0, 5);
  for (let i = 0; i < topTerms.length - 1; i++) {
    variations.push(`${topTerms[i]} ${topTerms[i + 1]}`);
  }
  
  return variations.filter(v => 
    !existingKeywords.some(e => e.includes(v) || v.includes(e))
  ).slice(0, 10);
}

async function fetchAdditionalKeywords(
  seedKeywords: string[],
  locationCode: number,
  existingKeywords: string[],
  contextTerms: string[]
): Promise<{ keyword: string; volume: number; difficulty: number }[]> {
  const results: { keyword: string; volume: number; difficulty: number }[] = [];
  const brandName = seedKeywords[0]?.split(' ')[0] || '';
  
  try {
    const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        keywords: seedKeywords.slice(0, 5),
        location_code: locationCode, language_code: 'fr',
        sort_by: 'search_volume', include_adult_keywords: false,
      }]),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status_code === 20000 && data.tasks?.[0]?.result) {
        for (const item of data.tasks[0].result) {
          if (item.keyword && item.search_volume > 0) {
            if (existingKeywords.some(e => e === item.keyword.toLowerCase())) continue;
            // CONTEXTUAL FILTER: reject keywords not related to site's core business
            if (!isContextuallyRelevant(item.keyword, contextTerms, brandName)) {
              console.log(`🚫 Filtered out (off-topic): "${item.keyword}"`);
              continue;
            }
            results.push({
              keyword: item.keyword,
              volume: item.search_volume || 0,
              difficulty: item.competition_index || Math.round((item.competition || 0.3) * 100),
            });
          }
        }
      }
    } else {
      await response.text();
    }

    if (results.length < 5) {
      const volumeResponse = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
        method: 'POST',
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          keywords: seedKeywords, location_code: locationCode, language_code: 'fr',
        }]),
      });

      if (volumeResponse.ok) {
        const volumeData = await volumeResponse.json();
        if (volumeData.status_code === 20000 && volumeData.tasks?.[0]?.result) {
          for (const item of volumeData.tasks[0].result) {
            if (item.keyword && item.search_volume > 0) {
              if (!results.find(r => r.keyword.toLowerCase() === item.keyword.toLowerCase()) &&
                  !existingKeywords.some(e => e === item.keyword.toLowerCase())) {
                if (!isContextuallyRelevant(item.keyword, contextTerms, brandName)) continue;
                results.push({
                  keyword: item.keyword,
                  volume: item.search_volume || 0,
                  difficulty: item.competition ? Math.round(item.competition * 100) : 30,
                });
              }
            }
          }
        }
      } else {
        await volumeResponse.text();
      }
    }
  } catch (error) {
    console.error('❌ Error fetching additional keywords:', error);
  }
  
  return results.sort((a, b) => b.volume - a.volume).slice(0, 15);
}

async function checkNewRankings(
  keywords: { keyword: string; volume: number; difficulty: number }[],
  domain: string,
  locationCode: number
): Promise<KeywordItem[]> {
  const results: KeywordItem[] = [];
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  const EXCLUDED_TYPES = new Set(['paid', 'ads']);
  
  // Check ALL keywords — position must always be filled
  const keywordsToCheck = keywords;
  
  // Process in batches of 10 (DataForSEO limit per request)
  const batchSize = 10;
  for (let batch = 0; batch < keywordsToCheck.length; batch += batchSize) {
    const batchKws = keywordsToCheck.slice(batch, batch + batchSize);
    
    try {
      const tasks = batchKws.map(kw => ({
        keyword: kw.keyword, location_code: locationCode, language_code: 'fr',
        depth: 100, se_domain: 'google.fr',
      }));
      
      const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
        method: 'POST',
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(tasks),
      });

      if (response.ok) {
        const data = await response.json();
        
        for (let i = 0; i < batchKws.length; i++) {
          const kw = batchKws[i];
          const taskResult = data.tasks?.[i]?.result?.[0];
          let position: number | string = 'Non classé';
          
          if (taskResult?.items) {
            for (const item of taskResult.items) {
              if (EXCLUDED_TYPES.has(item.type)) continue;
              const itemDomain = (item.domain || '').toLowerCase().replace(/^www\./, '');
              const itemUrl = (item.url || '').toLowerCase();
              const domainMatch = itemDomain && (
                itemDomain === cleanDomain ||
                itemDomain.endsWith('.' + cleanDomain) ||
                cleanDomain.endsWith('.' + itemDomain)
              );
              if (domainMatch || itemUrl.includes(cleanDomain)) {
                position = item.rank_absolute || item.rank_group || 1;
                break;
              }
              if (item.items && Array.isArray(item.items)) {
                for (const sub of item.items) {
                  const subDomain = (sub.domain || '').toLowerCase().replace(/^www\./, '');
                  if (subDomain === cleanDomain || (sub.url || '').toLowerCase().includes(cleanDomain)) {
                    position = item.rank_absolute || item.rank_group || 1;
                    break;
                  }
                }
                if (position !== 'Non classé') break;
              }
            }
          }
          
          results.push({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, current_rank: position });
        }
      } else {
        await response.text();
        // If API fails, still add keywords with "Non classé"
        for (const kw of batchKws) {
          results.push({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, current_rank: 'Non classé' });
        }
      }
    } catch (error) {
      console.error('❌ Error checking rankings batch:', error);
      for (const kw of batchKws) {
        results.push({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, current_rank: 'Non classé' });
      }
    }
  }
  
  return results;
}
