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
    const { domain, existingKeywords, brandName, locationCode } = await req.json();

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

    // Extract brand name from domain if not provided
    const extractedBrand = brandName || extractBrandFromDomain(domain);
    const location = locationCode || 2250; // Default to France

    // Generate new seed keywords based on variations
    const existingKws = (existingKeywords || []).map((k: any) => k.keyword?.toLowerCase() || '');
    const newSeeds = generateMoreSeedKeywords(extractedBrand, existingKws);

    console.log(`🔍 New seed keywords: ${newSeeds.join(', ')}`);

    // Fetch keyword data from DataForSEO
    const newKeywords = await fetchAdditionalKeywords(newSeeds, location, existingKws);

    // Check rankings for new keywords
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
  const tlds = ['com', 'fr', 'net', 'org', 'io', 'co', 'be', 'ch', 'de', 'es', 'it', 'uk'];
  
  const significantParts = parts.filter(part => 
    !prefixes.includes(part) && !tlds.includes(part) && part.length > 2
  );
  
  if (significantParts.length > 0) {
    return significantParts[0].replace(/-/g, ' ');
  }
  return parts[0].replace(/-/g, ' ');
}

function generateMoreSeedKeywords(brandName: string, existingKeywords: string[]): string[] {
  const brand = brandName.toLowerCase().trim();
  
  // Generate diverse variations
  const variations = [
    `${brand} prix`,
    `${brand} promotion`,
    `${brand} livraison`,
    `${brand} france`,
    `${brand} en ligne`,
    `${brand} pas cher`,
    `${brand} soldes`,
    `${brand} comparatif`,
    `${brand} alternative`,
    `${brand} concurrent`,
    `${brand} test`,
    `${brand} qualité`,
    `${brand} nouveautés`,
    `${brand} catalogue`,
    `${brand} service client`,
    `meilleur ${brand}`,
    `où acheter ${brand}`,
    `code promo ${brand}`,
    `${brand} avis clients`,
    `${brand} recommandation`,
  ];
  
  // Filter out existing keywords
  return variations.filter(v => 
    !existingKeywords.some(e => e.includes(v) || v.includes(e))
  ).slice(0, 10);
}

async function fetchAdditionalKeywords(
  seedKeywords: string[],
  locationCode: number,
  existingKeywords: string[]
): Promise<{ keyword: string; volume: number; difficulty: number }[]> {
  const results: { keyword: string; volume: number; difficulty: number }[] = [];
  
  try {
    // Use keywords_for_keywords to get related keywords
    const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        keywords: seedKeywords.slice(0, 5),
        location_code: locationCode,
        language_code: 'fr',
        sort_by: 'search_volume',
        include_adult_keywords: false,
      }]),
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.status_code === 20000 && data.tasks?.[0]?.result) {
        for (const item of data.tasks[0].result) {
          if (item.keyword && item.search_volume > 0) {
            // Skip if already exists
            if (existingKeywords.some(e => e === item.keyword.toLowerCase())) continue;
            
            results.push({
              keyword: item.keyword,
              volume: item.search_volume || 0,
              difficulty: item.competition_index || Math.round((item.competition || 0.3) * 100),
            });
          }
        }
      }
    }

    // Fallback: search_volume for seed keywords
    if (results.length < 5) {
      const volumeResponse = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          keywords: seedKeywords,
          location_code: locationCode,
          language_code: 'fr',
        }]),
      });

      if (volumeResponse.ok) {
        const volumeData = await volumeResponse.json();
        
        if (volumeData.status_code === 20000 && volumeData.tasks?.[0]?.result) {
          for (const item of volumeData.tasks[0].result) {
            if (item.keyword && item.search_volume > 0) {
              if (!results.find(r => r.keyword.toLowerCase() === item.keyword.toLowerCase()) &&
                  !existingKeywords.some(e => e === item.keyword.toLowerCase())) {
                results.push({
                  keyword: item.keyword,
                  volume: item.search_volume || 0,
                  difficulty: item.competition ? Math.round(item.competition * 100) : 30,
                });
              }
            }
          }
        }
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
  
  // Check rankings for top 8 keywords
  const keywordsToCheck = keywords.slice(0, 8);
  
  try {
    const tasks = keywordsToCheck.map(kw => ({
      keyword: kw.keyword,
      location_code: locationCode,
      language_code: 'fr',
      depth: 30,
      se_domain: 'google.fr',
    }));
    
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tasks),
    });

    if (response.ok) {
      const data = await response.json();
      
      for (let i = 0; i < keywordsToCheck.length; i++) {
        const kw = keywordsToCheck[i];
        const taskResult = data.tasks?.[i]?.result?.[0];
        
        let position: number | string = 'Non classé';
        
        if (taskResult?.items) {
          for (const item of taskResult.items) {
            if (item.type === 'organic' && item.domain) {
              const itemDomain = item.domain.toLowerCase().replace(/^www\./, '');
              if (itemDomain.includes(cleanDomain) || cleanDomain.includes(itemDomain)) {
                position = item.rank_absolute || item.rank_group || 1;
                break;
              }
            }
          }
        }
        
        results.push({
          keyword: kw.keyword,
          volume: kw.volume,
          difficulty: kw.difficulty,
          current_rank: position,
        });
      }
    }
    
    // Add remaining keywords without SERP check
    for (let i = 8; i < keywords.length; i++) {
      results.push({
        keyword: keywords[i].keyword,
        volume: keywords[i].volume,
        difficulty: keywords[i].difficulty,
        current_rank: 'Non vérifié',
      });
    }
  } catch (error) {
    console.error('❌ Error checking rankings:', error);
    return keywords.map(kw => ({
      ...kw,
      current_rank: 'Non vérifié',
    }));
  }
  
  return results;
}