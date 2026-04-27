import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { callLovableAI, isLovableAIConfigured } from '../_shared/lovableAI.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

function getAuthHeader(): string {
  return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;
}

interface KeywordItem {
  keyword: string;
  volume: number;
  difficulty: number;
  current_rank: number | string;
  strategic_analysis?: {
    intent: string;
    business_value: 'High' | 'Medium' | 'Low';
    pain_point: string;
    recommended_action: string;
  };
}

Deno.serve(handleRequest(async (req) => {
try {
    const { domain, existingKeywords, brandName, locationCode, siteContext, mode } = await req.json();

    if (!domain) {
      return jsonError('Domain is required', 400);
    }

    const effectiveMode = mode || 'initial';
    console.log(`📊 Generating keywords for ${domain} (mode: ${effectiveMode})`);

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      return jsonOk({ keywords: [], error: 'DataForSEO not configured' });
    }

    const extractedBrand = brandName || extractBrandFromDomain(domain);
    const location = locationCode || 2250;
    const existingKws = (existingKeywords || []).map((k: any) => k.keyword?.toLowerCase() || '');

    // ═══ PHASE 1: AI-Driven Seed Generation ═══
    let seeds = await generateSeedsWithAI(domain, siteContext || '', extractedBrand, effectiveMode, existingKws);
    
    if (seeds.length < 5) {
      // Fallback to rule-based seeds
      console.log('⚠️ AI seeds insufficient, using fallback');
      const contextTerms = buildContextTerms(existingKws, siteContext || '');
      seeds = generateFallbackSeeds(extractedBrand, existingKws, contextTerms, effectiveMode);
    }
    
    console.log(`🔍 Seeds (${effectiveMode}): ${seeds.join(', ')}`);

    // ═══ PHASE 2: DataForSEO API Call ═══
    const newKeywords = await fetchAdditionalKeywords(seeds, location, existingKws);
    
    // ═══ PHASE 3: Validation Loop ═══
    let finalKeywords = newKeywords;
    if (newKeywords.length < 3 || newKeywords.reduce((s, k) => s + k.volume, 0) / Math.max(newKeywords.length, 1) < 50) {
      console.log('🔄 Poor quality — retrying with refined seeds...');
      const feedback = `Seulement ${newKeywords.length} résultats avec volume moyen faible. Utilise des expressions plus populaires.`;
      const refinedSeeds = await generateSeedsWithAI(domain, siteContext || '', extractedBrand, effectiveMode, existingKws, feedback);
      if (refinedSeeds.length >= 3) {
        const refinedKws = await fetchAdditionalKeywords(refinedSeeds, location, existingKws);
        if (refinedKws.length > finalKeywords.length) {
          finalKeywords = refinedKws;
        }
      }
    }
    
    // ═══ PHASE 4: Check Rankings ═══
    const rankedKeywords = await checkNewRankings(finalKeywords, domain, location);
    
    // ═══ PHASE 5: AI Strategic Synthesis ═══
    const enrichedKeywords = await synthesizeStrategicAnalysis(rankedKeywords, domain, siteContext || '', effectiveMode);

    console.log(`✅ Generated ${enrichedKeywords.length} keywords (mode: ${effectiveMode})`);

    return jsonOk({ 
        success: true, 
        keywords: enrichedKeywords,
        count: enrichedKeywords.length,
        mode: effectiveMode,
      });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error:', error);
    return jsonError(errorMessage, 500);
  }
});

function extractBrandFromDomain(domain: string): string {
  const parts = domain.toLowerCase().split('.');
  const prefixes = ['www', 'fr', 'en', 'de', 'es', 'it', 'us', 'uk', 'shop', 'store', 'm', 'mobile'];
  const tlds = ['com', 'fr', 'net', 'org', 'io', 'co', 'be', 'ch', 'de', 'es', 'it', 'uk', 'ai'];
  const significantParts = parts.filter(part => !prefixes.includes(part) && !tlds.includes(part) && part.length > 2);
  return significantParts.length > 0 ? significantParts[0].replace(/-/g, ' ') : parts[0].replace(/-/g, ' ');
}

async function generateSeedsWithAI(
  domain: string,
  siteContext: string,
  brandName: string,
  mode: string,
  existingKws: string[],
  feedback?: string
): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return [];

  const modeInstructions: Record<string, string> = {
    initial: "Services principaux + intentions d'achat.",
    vertical: "PROFONDEUR: Sous-catégories techniques, longue traîne, niches métier, conversion locale. Creuse les micro-segments du métier.",
    horizontal: "EXPANSION: Étapes amont du parcours client (financement, permis, diagnostic, formation), besoins connexes, problèmes adjacents que les mêmes clients rencontrent.",
  };

  const existingList = existingKws.slice(0, 10).join(', ');
  
  const prompt = `Tu es un Senior SEO Strategist. Analyse le domaine "${domain}".
Contexte du site: ${siteContext || 'Non disponible'}
Mots-clés existants: ${existingList}

RÈGLE D'OR: NE CITE JAMAIS la marque "${brandName}". Mots-clés 100% génériques.

MODE: ${mode.toUpperCase()}
${modeInstructions[mode] || modeInstructions.initial}
${feedback ? `\n⚠️ FEEDBACK: ${feedback}` : ''}

Génère 15 NOUVEAUX mots-clés (différents des existants) que des clients potentiels taperaient dans Google.
Expressions de 2-5 mots à forte intention.

JSON uniquement: {"seeds": ["mot clé 1", ...]}`;

  try {
    const resp = await callLovableAI({
      user: prompt,
      model: 'google/gemini-2.5-flash-lite',
      temperature: 0.5,
      signal: AbortSignal.timeout(12000),
    });

    const content = resp.content;
    trackTokenUsage('generate-more-keywords-seeds', 'google/gemini-2.5-flash-lite', resp.usage, domain);

    let seeds: string[] = [];
    try {
      let jsonStr = content;
      if (content.includes('```json')) jsonStr = content.split('```json')[1].split('```')[0].trim();
      else if (content.includes('```')) jsonStr = content.split('```')[1].split('```')[0].trim();
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      const parsed = JSON.parse(jsonStr);
      seeds = (parsed.seeds || []).filter((s: string) => typeof s === 'string' && s.length > 3);
    } catch {
      const match = content.match(/\[([^\]]+)\]/);
      if (match) seeds = match[1].split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter((s: string) => s.length > 3);
    }

    const brandLower = brandName.toLowerCase();
    seeds = seeds.filter(s => !s.toLowerCase().includes(brandLower) && !existingKws.includes(s.toLowerCase()));
    
    console.log(`🤖 AI seeds (${mode}): ${seeds.slice(0, 5).join(', ')} (${seeds.length} total)`);
    return seeds.slice(0, 15);
  } catch (error) {
    console.error('❌ AI seed error:', error);
    return [];
  }
}

async function synthesizeStrategicAnalysis(
  keywords: KeywordItem[],
  domain: string,
  siteContext: string,
  mode: string
): Promise<KeywordItem[]> {
  if (keywords.length === 0) return keywords;
  
  if (!isLovableAIConfigured()) return keywords;

  const kwList = keywords.slice(0, 10).map(k => 
    `"${k.keyword}" (vol:${k.volume}, diff:${k.difficulty}, pos:${k.current_rank})`
  ).join('\n');

  const prompt = `Analyse ces mots-clés pour le domaine "${domain}".
Contexte: ${siteContext || 'Non disponible'}
Mode d'exploration: ${mode}

Mots-clés:
${kwList}

Pour chaque mot-clé, fournis une analyse stratégique. Réponds en JSON:
{"analyses": [{"keyword": "...", "intent": "Transactionnel|Informatif|Décisionnel", "business_value": "High|Medium|Low", "pain_point": "Problème que l'utilisateur cherche à résoudre", "recommended_action": "Action concrète"}]}`;

  try {
    const resp = await callLovableAI({
      user: prompt,
      model: 'google/gemini-2.5-flash-lite',
      signal: AbortSignal.timeout(15000),
    });

    const content = resp.content;
    trackTokenUsage('generate-more-keywords-synthesis', 'google/gemini-2.5-flash-lite', resp.usage, domain);

    let analyses: any[] = [];
    try {
      let jsonStr = content;
      if (content.includes('```json')) jsonStr = content.split('```json')[1].split('```')[0].trim();
      else if (content.includes('```')) jsonStr = content.split('```')[1].split('```')[0].trim();
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      const parsed = JSON.parse(jsonStr);
      analyses = parsed.analyses || [];
    } catch { /* ignore parse errors */ }

    // Merge analyses into keywords
    for (const kw of keywords) {
      const analysis = analyses.find((a: any) => a.keyword?.toLowerCase() === kw.keyword.toLowerCase());
      if (analysis) {
        kw.strategic_analysis = {
          intent: analysis.intent || 'Informatif',
          business_value: analysis.business_value || 'Medium',
          pain_point: analysis.pain_point || '',
          recommended_action: analysis.recommended_action || '',
        };
      }
    }

    console.log(`✅ Strategic synthesis: ${analyses.length}/${keywords.length} enriched`);
    return keywords;
  } catch (error) {
    console.error('❌ Synthesis error:', error);
    return keywords;
  }
}

function buildContextTerms(existingKeywords: string[], siteContext: string): string[] {
  const terms = new Set<string>();
  const stopWords = new Set(['le','la','les','de','des','du','un','une','et','en','pour','par','sur','au','avec','dans','ou','plus','qui','que','est','son','sa','ses','ce','cette','pas','ne','se']);
  
  for (const kw of existingKeywords) {
    if (!kw) continue;
    const words = kw.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    for (const w of words) terms.add(w);
  }
  
  if (siteContext) {
    const contextWords = siteContext.toLowerCase().replace(/[^\wàâäéèêëïîôùûüÿçœæ\s-]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    for (const w of contextWords.slice(0, 20)) terms.add(w);
  }
  
  return [...terms];
}

function generateFallbackSeeds(brandName: string, existingKeywords: string[], contextTerms: string[], mode: string): string[] {
  const brand = brandName.toLowerCase().trim();
  const variations: string[] = [];
  
  if (mode === 'vertical') {
    for (const existing of existingKeywords.slice(0, 5)) {
      if (existing && existing.length > 3 && !existing.includes(brand)) {
        variations.push(`${existing} professionnel`);
        variations.push(`${existing} spécialisé`);
        variations.push(`meilleur ${existing}`);
      }
    }
  } else if (mode === 'horizontal') {
    const broadeners = ['financement', 'formation', 'diagnostic', 'accompagnement', 'certification'];
    for (const ctx of contextTerms.slice(0, 3)) {
      for (const b of broadeners.slice(0, 2)) {
        variations.push(`${b} ${ctx}`);
      }
    }
  } else {
    variations.push(`${brand} avis`, `${brand} alternative`, `${brand} comparatif`);
    for (const existing of existingKeywords.slice(0, 3)) {
      if (existing && !existing.includes(brand)) {
        variations.push(`meilleur ${existing}`);
      }
    }
  }
  
  return variations.filter(v => !existingKeywords.includes(v.toLowerCase())).slice(0, 10);
}

async function fetchAdditionalKeywords(
  seedKeywords: string[],
  locationCode: number,
  existingKeywords: string[]
): Promise<{ keyword: string; volume: number; difficulty: number }[]> {
  const results: { keyword: string; volume: number; difficulty: number }[] = [];
  
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
      trackPaidApiCall('generate-more-keywords', 'dataforseo', 'keywords_for_keywords');
      const data = await response.json();
      if (data.status_code === 20000 && data.tasks?.[0]?.result) {
        for (const item of data.tasks[0].result) {
          if (item.keyword && item.search_volume > 0) {
            if (existingKeywords.some(e => e === item.keyword.toLowerCase())) continue;
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

    // Fallback: search_volume for seeds
    if (results.length < 5) {
      const volumeResponse = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
        method: 'POST',
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keywords: seedKeywords, location_code: locationCode, language_code: 'fr' }]),
      });

      if (volumeResponse.ok) {
        const volumeData = await volumeResponse.json();
        if (volumeData.status_code === 20000 && volumeData.tasks?.[0]?.result) {
          for (const item of volumeData.tasks[0].result) {
            if (item.keyword && item.search_volume > 0 &&
                !results.find(r => r.keyword.toLowerCase() === item.keyword.toLowerCase()) &&
                !existingKeywords.some(e => e === item.keyword.toLowerCase())) {
              results.push({
                keyword: item.keyword,
                volume: item.search_volume || 0,
                difficulty: item.competition ? Math.round(item.competition * 100) : 30,
              });
            }
          }
        }
      } else { await volumeResponse.text(); }
    }
  } catch (error) {
    console.error('❌ Error fetching keywords:', error);
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
  
  const batchSize = 10;
  for (let batch = 0; batch < keywords.length; batch += batchSize) {
    const batchKws = keywords.slice(batch, batch + batchSize);
    
    try {
      const tasks = batchKws.map(kw => ({
        keyword: kw.keyword, location_code: locationCode, language_code: 'fr',
        depth: 50, se_domain: 'google.fr',
      }));
      
      const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
        method: 'POST',
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(tasks),
      }));

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
              if (itemDomain === cleanDomain || itemDomain.endsWith('.' + cleanDomain) || 
                  cleanDomain.endsWith('.' + itemDomain) || itemUrl.includes(cleanDomain)) {
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
        for (const kw of batchKws) results.push({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, current_rank: 'Non classé' });
      }
    } catch (error) {
      console.error('❌ Ranking error:', error);
      for (const kw of batchKws) results.push({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, current_rank: 'Non classé' });
    }
  }
  
  return results;
}