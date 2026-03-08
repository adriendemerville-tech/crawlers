import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Fonction pour générer un résumé promptable depuis le rapport stratégique
function generateStrategicPromptSummary(title: string, description: string, priority: string): string {
  const priorityLabel = priority === 'Prioritaire' ? '🔴 PRIORITAIRE' : priority === 'Important' ? '🟠 IMPORTANT' : '🟢 OPPORTUNITÉ';
  return `[${priorityLabel}] ${title} - ${description.substring(0, 200)}`;
}

// Fonction pour sauvegarder les recommandations stratégiques dans le registre
async function saveStrategicRecommendationsToRegistry(
  supabaseUrl: string,
  supabaseKey: string,
  authHeader: string,
  domain: string,
  url: string,
  parsedAnalysis: any
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return;
    
    await supabase
      .from('audit_recommendations_registry')
      .delete()
      .eq('user_id', user.id)
      .eq('domain', domain)
      .eq('audit_type', 'strategic');
    
    const registryEntries: any[] = [];
    
    if (parsedAnalysis.executive_roadmap && Array.isArray(parsedAnalysis.executive_roadmap)) {
      parsedAnalysis.executive_roadmap.forEach((item: any, idx: number) => {
        const priorityMap: Record<string, string> = { 'Prioritaire': 'critical', 'Important': 'important', 'Opportunité': 'optional' };
        registryEntries.push({
          user_id: user.id, domain, url,
          audit_type: 'strategic',
          recommendation_id: `roadmap_${idx}`,
          title: item.title || `Recommandation ${idx + 1}`,
          description: item.prescriptive_action || item.strategic_rationale || '',
          category: item.category?.toLowerCase() || 'contenu',
          priority: priorityMap[item.priority] || 'important',
          fix_type: null,
          fix_data: { expected_roi: item.expected_roi, category: item.category, full_action: item.prescriptive_action },
          prompt_summary: generateStrategicPromptSummary(item.title || `Recommandation ${idx + 1}`, item.prescriptive_action || '', item.priority || 'Important'),
          is_resolved: false,
        });
      });
    }
    
    if (parsedAnalysis.keyword_positioning?.recommendations && Array.isArray(parsedAnalysis.keyword_positioning.recommendations)) {
      parsedAnalysis.keyword_positioning.recommendations.forEach((rec: string, idx: number) => {
        registryEntries.push({
          user_id: user.id, domain, url,
          audit_type: 'strategic',
          recommendation_id: `kw_rec_${idx}`,
          title: `SEO Keywords #${idx + 1}`,
          description: rec,
          category: 'seo',
          priority: 'important',
          fix_type: null,
          fix_data: { type: 'keyword_recommendation' },
          prompt_summary: `[🟠 SEO] ${rec.substring(0, 200)}`,
          is_resolved: false,
        });
      });
    }
    
    if (registryEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('audit_recommendations_registry')
        .insert(registryEntries);
      if (insertError) console.error('❌ Registre stratégique:', insertError);
      else console.log(`✅ ${registryEntries.length} recommandations sauvegardées`);
    }
  } catch (error) {
    console.error('❌ Erreur registre:', error);
  }
}

// ==================== INTERFACES ====================

interface ToolsData {
  crawlers: any;
  geo: any;
  llm: any;
  pagespeed: any;
}

interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  is_ranked: boolean;
  current_rank: number | string;
}

interface MarketData {
  location_used: string;
  total_market_volume: number;
  top_keywords: KeywordData[];
  data_source: 'dataforseo' | 'fallback';
  fetch_timestamp: string;
}

interface BusinessContext {
  sector: string;
  location: string;
  brandName: string;
  locationCode: number | null;
}

// ==================== BRAND NAME HUMANIZATION ====================

function humanizeBrandName(slug: string): string {
  if (!slug || slug.length < 1) return slug;
  // Replace hyphens with spaces and capitalize each word
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function sanitizeBrandNameInResponse(obj: any, domainSlug: string, humanName: string): any {
  if (!obj || !domainSlug || !humanName || domainSlug === humanName) return obj;
  const slugLower = domainSlug.toLowerCase();
  function replaceInString(str: string): string {
    if (!str || typeof str !== 'string') return str;
    const regex = new RegExp(slugLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return str.replace(regex, humanName);
  }
  function walk(node: any): any {
    if (typeof node === 'string') return replaceInString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(node)) { out[k] = walk(v); }
      return out;
    }
    return node;
  }
  return walk(obj);
}

// ==================== DATAFORSEO FUNCTIONS ====================

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

function getAuthHeader(): string {
  return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;
}

// Well-known location codes to avoid downloading the full list
const KNOWN_LOCATIONS: Record<string, { code: number; name: string }> = {
  'france': { code: 2250, name: 'France' },
  'belgium': { code: 2056, name: 'Belgium' },
  'switzerland': { code: 2756, name: 'Switzerland' },
  'canada': { code: 2124, name: 'Canada' },
  'luxembourg': { code: 2442, name: 'Luxembourg' },
  'germany': { code: 2276, name: 'Germany' },
  'spain': { code: 2724, name: 'Spain' },
  'italy': { code: 2380, name: 'Italy' },
  'united kingdom': { code: 2826, name: 'United Kingdom' },
  'united states': { code: 2840, name: 'United States' },
};

/**
 * Détecte le contexte business ET le location code en une seule passe.
 * Évite de re-télécharger la liste des locations DataForSEO.
 */
function detectBusinessContext(domain: string): BusinessContext {
  const domainParts = domain.toLowerCase().split('.');
  const tld = domainParts[domainParts.length - 1];
  
  const tldToLocation: Record<string, string> = {
    'fr': 'france', 'be': 'belgium', 'ch': 'switzerland', 'ca': 'canada',
    'lu': 'luxembourg', 'de': 'germany', 'es': 'spain', 'it': 'italy',
    'uk': 'united kingdom', 'co.uk': 'united kingdom', 'com': 'france',
  };
  
  const locationKey = tldToLocation[tld] || 'france';
  const locationInfo = KNOWN_LOCATIONS[locationKey] || KNOWN_LOCATIONS['france'];
  
  const prefixes = ['www', 'fr', 'en', 'de', 'es', 'it', 'us', 'uk', 'shop', 'store', 'm', 'mobile'];
  const significantParts = domainParts.filter(part => 
    !prefixes.includes(part) && part.length > 2 && 
    !['com', 'fr', 'net', 'org', 'io', 'co', 'be', 'ch', 'de', 'es', 'it', 'uk'].includes(part)
  );
  
  const rawSlug = significantParts.length > 0 ? significantParts[0] : domainParts[0];
  const brandName = humanizeBrandName(rawSlug);
  const sector = rawSlug.replace(/-/g, ' ');
  
  console.log(`📋 Contexte: marque="${brandName}", secteur="${sector}", location="${locationInfo.name}" (code: ${locationInfo.code})`);
  
  return { sector, location: locationInfo.name, brandName, locationCode: locationInfo.code };
}

function extractKeywordsFromMetadata(pageContentContext: string): string[] {
  const extracted: string[] = [];
  // Extract title, h1, description from the context string
  const titleMatch = pageContentContext.match(/Titre="([^"?]+)/);
  const h1Match = pageContentContext.match(/H1="([^"?]+)/);
  const descMatch = pageContentContext.match(/Desc="([^"?]+)/);
  
  const texts = [titleMatch?.[1], h1Match?.[1], descMatch?.[1]].filter(Boolean) as string[];
  
  // Common French stop words to filter out
  const stopWords = new Set(['le','la','les','de','des','du','un','une','et','est','en','pour','par','sur','au','aux','il','elle','ce','cette','qui','que','son','sa','ses','se','ne','pas','avec','dans','ou','plus','vous','votre','vos','nous','notre','nos','leur','leurs','mon','ma','mes','ton','ta','tes','si','mais','car','donc','ni','comme','entre','chez','vers','très','aussi','bien','encore','tout','tous','même','autre','autres','quel','quelle','quels','quelles','chaque','quelque','certains','plusieurs','aucun','tel','telle','tels','telles']);
  
  for (const text of texts) {
    // Extract meaningful 2-3 word phrases
    const cleaned = text.toLowerCase()
      .replace(/[|–—·:]/g, ' ')
      .replace(/[^\wàâäéèêëïîôùûüÿçœæ\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const words = cleaned.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
    
    // Add individual significant words and bigrams
    for (const word of words) {
      if (word.length >= 3) extracted.push(word);
    }
    for (let i = 0; i < words.length - 1; i++) {
      extracted.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  // Deduplicate
  return [...new Set(extracted)].slice(0, 10);
}

function generateSeedKeywords(brandName: string, sector: string, pageContentContext: string = ''): string[] {
  const cleanBrand = brandName.toLowerCase().trim();
  const keywords = [
    cleanBrand, `${cleanBrand} avis`,
  ];
  if (sector.toLowerCase() !== cleanBrand) {
    keywords.push(sector, `meilleur ${sector}`);
  }
  
  // Enrich with page metadata keywords (title, h1, description)
  if (pageContentContext) {
    const metaKeywords = extractKeywordsFromMetadata(pageContentContext);
    for (const mk of metaKeywords) {
      if (!keywords.includes(mk) && mk !== cleanBrand) {
        keywords.push(mk);
      }
    }
  }
  
  return keywords.filter(kw => kw.length > 2 && !kw.includes('undefined')).slice(0, 10);
}

async function fetchKeywordData(
  seedKeywords: string[], locationCode: number
): Promise<{ keyword: string; volume: number; difficulty: number }[]> {
  console.log(`📊 Récupération mots-clés pour location: ${locationCode}`);
  const allKeywords: { keyword: string; volume: number; difficulty: number }[] = [];
  
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
            allKeywords.push({
              keyword: item.keyword,
              volume: item.search_volume || 0,
              difficulty: item.competition_index || Math.round((item.competition || 0.3) * 100),
            });
          }
        }
        console.log(`✅ ${allKeywords.length} mots-clés via Google Ads API`);
      }
    } else {
      await response.text(); // consume body
    }
    
    if (allKeywords.length < 10) {
      console.log('🔄 Fallback: search_volume...');
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
            if (item.keyword && item.search_volume > 0 &&
                !allKeywords.find(kw => kw.keyword.toLowerCase() === item.keyword.toLowerCase())) {
              allKeywords.push({
                keyword: item.keyword,
                volume: item.search_volume || 0,
                difficulty: item.competition ? Math.round(item.competition * 100) : 30,
              });
            }
          }
        }
      } else {
        await volumeResponse.text(); // consume body
      }
    }
  } catch (error) {
    console.error('❌ Erreur mots-clés:', error);
  }
  
  return allKeywords.sort((a, b) => b.volume - a.volume).slice(0, 15); // Reduced from 20 to 15
}

async function checkRankings(
  keywords: { keyword: string; volume: number; difficulty: number }[],
  domain: string, locationCode: number
): Promise<KeywordData[]> {
  console.log(`📈 Vérification positionnement pour ${domain}`);
  const results: KeywordData[] = [];
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  
  // Limit to 7 keywords to reduce memory (was 10)
  const keywordsToCheck = keywords.slice(0, 7);
  
  try {
    const tasks = keywordsToCheck.map(kw => ({
      keyword: kw.keyword, location_code: locationCode, language_code: 'fr',
      depth: 20, se_domain: 'google.fr', // Reduced depth from 30 to 20
    }));
    
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    });

    if (!response.ok) {
      await response.text(); // consume body
      return keywords.map(kw => ({ ...kw, is_ranked: false, current_rank: 'Non classé' }));
    }

    const data = await response.json();
    
    for (let i = 0; i < keywordsToCheck.length; i++) {
      const kw = keywordsToCheck[i];
      const taskResult = data.tasks?.[i]?.result?.[0];
      let position: number | string = 'Non classé';
      let isRanked = false;
      
      if (taskResult?.items) {
        for (const item of taskResult.items) {
          if (item.type === 'organic' && item.domain) {
            const itemDomain = item.domain.toLowerCase().replace(/^www\./, '');
            if (itemDomain.includes(cleanDomain) || cleanDomain.includes(itemDomain)) {
              position = item.rank_absolute || item.rank_group || 1;
              isRanked = true;
              break;
            }
          }
        }
      }
      results.push({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, is_ranked: isRanked, current_rank: position });
    }
    
    // Add remaining keywords without SERP check
    for (let i = 7; i < keywords.length; i++) {
      results.push({ keyword: keywords[i].keyword, volume: keywords[i].volume, difficulty: keywords[i].difficulty, is_ranked: false, current_rank: 'Non vérifié' });
    }
    
    // Release data reference
    console.log(`✅ Positionnement: ${results.filter(r => r.is_ranked).length}/${results.length} classés`);
  } catch (error) {
    console.error('❌ Erreur SERP:', error);
    return keywords.map(kw => ({ ...kw, is_ranked: false, current_rank: 'Non classé' }));
  }
  
  return results;
}

async function findLocalCompetitor(
  domain: string, sector: string, locationCode: number, pageContentContext: string
): Promise<{ name: string; url: string; rank: number } | null> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;

  let city = '';
  if (pageContentContext) {
    const cityPatterns = [
      /(?:à|a|en|sur)\s+([A-ZÀ-Ü][a-zà-ü]+(?:[-\s][A-ZÀ-Ü][a-zà-ü]+)*)/g,
      /([A-ZÀ-Ü][a-zà-ü]+(?:[-\s][A-ZÀ-Ü][a-zà-ü]+)*)\s*(?:\d{5})/g,
    ];
    for (const pattern of cityPatterns) {
      const match = pattern.exec(pageContentContext);
      if (match?.[1] && match[1].length > 2 && match[1].length < 30) {
        city = match[1];
        break;
      }
    }
  }

  const localQuery = city ? `${sector} ${city}` : sector;
  console.log(`🏙️ Recherche concurrent local: "${localQuery}"`);

  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        keyword: localQuery, location_code: locationCode, language_code: 'fr',
        depth: 15, se_domain: 'google.fr', // Reduced depth from 20 to 15
      }]),
    });

    if (!response.ok) {
      await response.text();
      return null;
    }

    const data = await response.json();
    const items = data.tasks?.[0]?.result?.[0]?.items;
    if (!items || !Array.isArray(items)) return null;

    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
    const organicResults = items.filter((item: any) => item.type === 'organic' && item.domain && item.url);
    const targetIdx = organicResults.findIndex((item: any) => {
      const d = item.domain.toLowerCase().replace(/^www\./, '');
      return d.includes(cleanDomain) || cleanDomain.includes(d);
    });

    let competitor: any = null;
    const isDifferent = (item: any) => {
      const d = item.domain.toLowerCase().replace(/^www\./, '');
      return !d.includes(cleanDomain) && !cleanDomain.includes(d);
    };

    if (targetIdx === -1) {
      competitor = organicResults.find(isDifferent);
    } else if (targetIdx === 0) {
      competitor = organicResults.find((item: any, idx: number) => idx > targetIdx && isDifferent(item));
    } else {
      for (let i = targetIdx - 1; i >= 0; i--) {
        if (isDifferent(organicResults[i])) { competitor = organicResults[i]; break; }
      }
      if (!competitor) competitor = organicResults.find(isDifferent);
    }

    if (competitor) {
      const result = {
        name: competitor.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || competitor.domain,
        url: competitor.url,
        rank: competitor.rank_absolute || competitor.rank_group || 0,
      };
      console.log(`✅ Concurrent local: "${result.name}" position ${result.rank}`);
      return result;
    }
    return null;
  } catch (error) {
    console.error('❌ Erreur concurrent local:', error);
    return null;
  }
}

async function fetchMarketData(domain: string, context: BusinessContext): Promise<MarketData | null> {
  console.log('🚀 Collecte DataForSEO pour:', domain);
  
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD || !context.locationCode) {
    console.log('⚠️ DataForSEO non disponible');
    return null;
  }
  
  try {
    const seedKeywords = generateSeedKeywords(context.brandName, context.sector);
    console.log('🌱 Mots-clés seed:', seedKeywords);
    
    const keywordData = await fetchKeywordData(seedKeywords, context.locationCode);
    if (keywordData.length === 0) {
      console.log('⚠️ Aucun mot-clé trouvé');
      return null;
    }
    
    const rankedKeywords = await checkRankings(keywordData, domain, context.locationCode);
    const totalVolume = rankedKeywords.reduce((sum, kw) => sum + kw.volume, 0);
    
    console.log(`✅ Données: ${rankedKeywords.length} mots-clés, volume: ${totalVolume}`);
    
    return {
      location_used: context.location,
      total_market_volume: totalVolume,
      top_keywords: rankedKeywords,
      data_source: 'dataforseo',
      fetch_timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Erreur DataForSEO:', error);
    return null;
  }
}

// ==================== LLM PROMPT (compact) ====================

const SYSTEM_PROMPT = `RÔLE: Senior Digital Strategist spécialisé Brand Authority & GEO. Rapport premium niveau cabinet de conseil.

POSTURE: Analytique, souverain, prescriptif. Jargon expert (Entité sémantique, Topical Authority, E-E-A-T, Gap de citabilité). Recommandations NARRATIVES: chaque action = paragraphe rédigé 4-5 phrases.

DONNÉES DE MARCHÉ RÉELLES (DataForSEO): Utilise les volumes, difficultés et positions RÉELS. Identifie Quick Wins (position 11-20, volume>100), Contenus manquants (non classé, volume>200).

13 MODULES D'ANALYSE:
A. ÉCOSYSTÈME: 1.Market Leader 2.Concurrent Direct 3.Challenger 4.Source d'Inspiration
B. AUTORITÉ SOCIALE: 5.Preuve Sociale (Reddit,X,LinkedIn) 6.Thought Leadership E-E-A-T 7.Sentiment & Polarité
C. EXPERTISE: 8.Score GEO Citabilité 9.Matrice Gap Sémantique 10.Psychologie Conversion
D. MOTS CLÉS: 11.5 Principaux avec volumes réels 12.Opportunités 13.Gaps Concurrentiels
E. TECHNIQUE: 14.Accessibilité Bots IA 15.Performance 16.Cohérence Sémantique
F. FRAÎCHEUR & IA: 17.Fraîcheur contenus 18.Complexité Schema.org 19.Formats IA-Ready 20.First-Party Data 21.Changelog Marque
G. E-E-A-T: 22.Signaux E-E-A-T 23.Densité données 24.Knowledge Graph 25.Études de cas
H. MONITORING: 26.Monitoring LLM (GA4 referrers IA) 27.Fichier llms.txt`;

function buildUserPrompt(url: string, domain: string, toolsData: ToolsData, marketData: MarketData | null, pageContentContext: string = ''): string {
  let marketSection = '';
  
  if (marketData) {
    const kwList = marketData.top_keywords.map(kw => 
      `"${kw.keyword}":${kw.volume}vol,diff${kw.difficulty},pos:${kw.current_rank}`
    ).join('; ');
    
    const quickWins = marketData.top_keywords.filter(kw => 
      typeof kw.current_rank === 'number' && kw.current_rank >= 11 && kw.current_rank <= 20 && kw.volume > 100
    );
    const missing = marketData.top_keywords.filter(kw => !kw.is_ranked && kw.volume > 200);
    
    marketSection = `
📊 DONNÉES MARCHÉ (DataForSEO) - Zone: ${marketData.location_used}, Volume total: ${marketData.total_market_volume}
Mots-clés: ${kwList}
Quick Wins: ${quickWins.length > 0 ? quickWins.map(kw => `"${kw.keyword}" pos${kw.current_rank}(${kw.volume}vol)`).join(', ') : 'Aucun'}
Manquants: ${missing.length > 0 ? missing.map(kw => `"${kw.keyword}"(${kw.volume}vol)`).join(', ') : 'Aucun'}
`;
  } else {
    marketSection = `⚠️ DataForSEO non disponible - base-toi sur ton analyse du secteur.\n`;
  }

  // Compact JSON serialization (no pretty-print to save memory)
  return `Analyse "${domain}" (${url}):
${pageContentContext}
${marketSection}
CRAWLERS:${JSON.stringify(toolsData.crawlers)}
GEO:${JSON.stringify(toolsData.geo)}
LLM:${JSON.stringify(toolsData.llm)}
PAGESPEED:${JSON.stringify(toolsData.pagespeed)}

GÉNÈRE UN JSON avec cette structure:
{"introduction":{"presentation":"4-5 phrases","strengths":"4-5 phrases","improvement":"4-5 phrases","competitors":["Leader","Concurrent","Challenger"]},
"brand_authority":{"dna_analysis":"...","thought_leadership_score":0-100,"entity_strength":"dominant|established|emerging|unknown"},
"social_signals":{"proof_sources":[{"platform":"reddit|x|linkedin|youtube","presence_level":"strong|moderate|weak|absent","analysis":"..."}],"thought_leadership":{"founder_authority":"high|moderate|low|unknown","entity_recognition":"...","eeat_score":0-10,"analysis":"..."},"sentiment":{"overall_polarity":"positive|mostly_positive|neutral|mixed|negative","hallucination_risk":"low|medium|high","reputation_vibration":"..."}},
"market_intelligence":{"sophistication":{"level":1-5,"description":"...","emotional_levers":["1","2","3"]},"semantic_gap":{"current_position":0-100,"leader_position":0-100,"gap_analysis":"...","closing_strategy":"..."}},
"competitive_landscape":{"leader":{"name":"...","authority_factor":"...","dominance_analysis":"..."},"direct_competitor":{"name":"...","url":"URL VALIDE OBLIGATOIRE","parity_analysis":"...","authority_factor":"..."},"challenger":{"name":"...","disruption_factor":"...","threat_analysis":"..."},"inspiration_source":{"name":"...","benchmark_quality":"...","adaptation_strategy":"..."}},
"geo_citability":{"score":0-100,"readiness_level":"pioneer|ready|developing|basic|absent","analysis":"...","strengths":["..."],"weaknesses":["..."],"recommendations":["..."]},
"llm_visibility":{"citation_probability":0-100,"knowledge_graph_presence":"strong|moderate|weak|absent","analysis":"...","test_queries":[{"query":"...","purpose":"...","target_llms":["ChatGPT","Claude","Perplexity"]}]},
"conversational_intent":{"ratio":0-100,"analysis":"...","question_titles_detected":0,"total_titles_analyzed":0,"examples":["OBLIGATOIRE: 3-5 reformulations en QUESTIONS NATURELLES directement liées au business/produits/services du site analysé. Ex pour un e-commerce de matériaux: 'Quel isolant naturel choisir pour une maison ancienne ?'. Ne PAS donner d'exemples génériques."],"recommendations":["..."]},
"zero_click_risk":{"at_risk_keywords":[{"keyword":"...","volume":0,"risk_level":"high|medium|low","sge_threat":"...","defense_strategy":"..."}],"overall_risk_score":0-100,"analysis":"..."},
"priority_content":{"missing_pages":[{"title":"...","rationale":"...","target_keywords":["..."],"expected_impact":"high|medium|low"}],"content_upgrades":[{"page":"...","current_issue":"...","upgrade_strategy":"..."}]},
"keyword_positioning":{"main_keywords":[{"keyword":"...","volume":0,"difficulty":0,"current_rank":"..."}],"quick_wins":[{"keyword":"...","current_rank":0,"volume":0,"action":"..."}],"content_gaps":[{"keyword":"...","volume":0,"priority":"high|medium|low","action":"..."}],"opportunities":["..."],"competitive_gaps":["..."],"recommendations":["..."]},
"market_data_summary":{"total_market_volume":0,"keywords_ranked":0,"keywords_analyzed":0,"average_position":0,"data_source":"dataforseo|fallback"},
"executive_roadmap":[{"title":"...","prescriptive_action":"Paragraphe 4-5 phrases","strategic_rationale":"...","expected_roi":"High|Medium|Low","category":"Identité|Contenu|Autorité|Social|Technique","priority":"Prioritaire|Important|Opportunité"}],
"executive_summary":"3-4 phrases pour CEO/CMO",
"overallScore":0-100}

INSTRUCTIONS CRITIQUES:
- UTILISE LES DONNÉES RÉELLES pour keyword_positioning et market_data_summary
- executive_roadmap: MINIMUM 6 recommandations narratives dont AU MOINS 1 avec category "Social"
- Recommandation Social: identifier LE réseau social adapté à la marque, stratégie concrète, impact sur citabilité IA
- GOLIATH=leader national/international massif. CONCURRENT LOCAL=acteur SERP local avec URL valide obligatoire
- JSON pur, sans virgules traînantes`;
}

// ==================== EXTRACT PAGE METADATA (lightweight) ====================

async function extractPageMetadata(url: string): Promise<{ context: string; brandName: string }> {
  let pageContentContext = '';
  let extractedBrandName = '';
  
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    console.log('📄 Fetching page metadata...');
    const pageResp = await fetch(normalizedUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    
    if (!pageResp.ok) {
      await pageResp.text(); // consume
      return { context: '', brandName: '' };
    }
    
    let html = await pageResp.text();
    
    // SPA detection — only fetch rendered version if really needed
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';
    const textOnly = bodyContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (textOnly.length < 200 && html.length > 1000) {
      console.log(`📄 SPA detected (${textOnly.length} chars). Trying JS rendering...`);
      const RENDERING_KEY = Deno.env.get('RENDERING_API_KEY');
      if (RENDERING_KEY) {
        try {
          const renderResponse = await fetch(`https://chrome.browserless.io/content?token=${RENDERING_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: normalizedUrl,
              rejectResourceTypes: ['image', 'media', 'font', 'stylesheet'],
              waitFor: 2000, // Reduced from 3000
              gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 }, // Reduced from 25000
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }),
            signal: AbortSignal.timeout(20000), // Reduced from 30000
          });
          
          if (renderResponse.ok) {
            const renderedHtml = await renderResponse.text();
            if (renderedHtml.length > html.length) {
              // Only keep the head section to save memory, we only need metadata
              const headMatch = renderedHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
              const h1Match = renderedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
              // Replace html with a minimal version containing only what we need
              html = (headMatch ? `<head>${headMatch[1]}</head>` : '') + 
                     (h1Match ? `<body><h1>${h1Match[1]}</h1></body>` : '');
              console.log(`📄 ✅ JS rendering success, kept metadata only`);
            }
          } else {
            console.log(`📄 ⚠️ Rendering error: ${renderResponse.status}`);
            await renderResponse.text(); // consume
          }
        } catch (renderErr) {
          console.log('📄 ⚠️ Rendering failed:', renderErr instanceof Error ? renderErr.message : renderErr);
        }
      }
    } else {
      // For non-SPA sites, only keep <head> + first <h1> to reduce memory
      const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      html = (headMatch ? `<head>${headMatch[1]}</head>` : '') + 
             (h1Match ? `<body><h1>${h1Match[1]}</h1></body>` : '');
    }
    
    // Extract metadata from the (now minimal) HTML
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*?)["']/i)
      || html.match(/<meta\s+content=["']([^"']*?)["']\s+name=["']description["']/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const ogSiteNameMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']*?)["']/i);
    const jsonLdMatch = html.match(/"@type"\s*:\s*"Organization"[\s\S]*?"name"\s*:\s*"([^"]+)"/i)
      || html.match(/"name"\s*:\s*"([^"]+)"[\s\S]*?"@type"\s*:\s*"Organization"/i);
    const appNameMatch = html.match(/<meta\s+name=["']application-name["']\s+content=["']([^"']*?)["']/i);
    
    if (ogSiteNameMatch?.[1]?.trim()) extractedBrandName = ogSiteNameMatch[1].trim();
    else if (jsonLdMatch?.[1]?.trim()) extractedBrandName = jsonLdMatch[1].trim();
    else if (appNameMatch?.[1]?.trim()) extractedBrandName = appNameMatch[1].trim();
    else if (titleMatch?.[1]) {
      const titleText = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      for (const sep of [' | ', ' - ', ' — ', ' – ', ' :: ', ' · ']) {
        if (titleText.includes(sep)) {
          const candidate = titleText.split(sep).pop()?.trim() || '';
          if (candidate.length >= 2 && candidate.length <= 50) extractedBrandName = candidate;
          break;
        }
      }
    }
    
    if (extractedBrandName) console.log(`🏷️ Marque HTML: "${extractedBrandName}"`);
    
    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    const metaDesc = metaDescMatch?.[1]?.trim() || '';
    const h1 = h1Match?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    
    if (title || metaDesc || h1) {
      pageContentContext = `
CONTENU PAGE: Titre="${title||'?'}", Desc="${(metaDesc||'?').substring(0,200)}", H1="${h1||'?'}"
Utilise ces informations pour identifier le core business.`;
      console.log(`✅ Metadata: title="${title.substring(0,50)}", h1="${h1.substring(0,50)}"`);
    }
    
    // Release html reference
    html = '';
  } catch (e) {
    console.log('⚠️ Page fetch failed:', e instanceof Error ? e.message : e);
  }
  
  return { context: pageContentContext, brandName: extractedBrandName };
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, toolsData, hallucinationCorrections, competitorCorrections } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveToolsData: ToolsData = toolsData || {
      crawlers: { note: 'Non disponible' },
      geo: { note: 'Non disponible' },
      llm: { note: 'Non disponible' },
      pagespeed: { note: 'Non disponible' },
    };

    // ==================== FETCH PAGE METADATA (lightweight) ====================
    const { context: pageContentContext, brandName: extractedBrandName } = await extractPageMetadata(url);

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const domain = new URL(normalizedUrl).hostname;
    // Skip www prefix when extracting domain slug for brand name
    const domainWithoutWww = domain.replace(/^www\./, '');
    const domainSlug = domainWithoutWww.split('.')[0];
    const humanBrandName = extractedBrandName || humanizeBrandName(domainSlug);
    console.log(`🏷️ Marque finale: "${humanBrandName}" (${extractedBrandName ? 'HTML' : 'slug'})`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🚀 AUDIT STRATÉGIQUE pour: ${domain} (${humanBrandName})`);

    // ==================== SINGLE context detection (no duplicate API calls) ====================
    const context = detectBusinessContext(domain);

    // ==================== ÉTAPE 1: DATAFORSEO (uses cached context) ====================
    console.log('\n📊 ÉTAPE 1: DataForSEO...');
    const marketData = await fetchMarketData(domain, context);

    // ==================== ÉTAPE 1b: CONCURRENT LOCAL ====================
    console.log('\n🏙️ ÉTAPE 1b: Concurrent local...');
    let localCompetitorData: { name: string; url: string; rank: number } | null = null;
    if (context.locationCode) {
      try {
        localCompetitorData = await findLocalCompetitor(domain, context.sector, context.locationCode, pageContentContext);
      } catch (e) {
        console.error('❌ Concurrent local:', e);
      }
    }

    // ==================== ÉTAPE 1c: CHECK-LLM (skip if toolsData already has LLM data) ====================
    if (!toolsData?.llm || toolsData.llm.note) {
      console.log('\n🤖 ÉTAPE 1c: check-llm...');
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        
        if (supabaseUrl && supabaseAnonKey) {
          const llmResponse = await fetch(`${supabaseUrl}/functions/v1/check-llm`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, lang: 'fr' }),
            signal: AbortSignal.timeout(30000), // 30s timeout for sub-function
          });
          
          if (llmResponse.ok) {
            const llmResult = await llmResponse.json();
            if (llmResult.success && llmResult.data) {
              effectiveToolsData.llm = llmResult.data;
              console.log(`✅ LLM: score ${llmResult.data.overallScore}/100`);
            }
          } else {
            await llmResponse.text(); // consume
            console.log('⚠️ check-llm error:', llmResponse.status);
          }
        }
      } catch (e) {
        console.error('❌ check-llm:', e);
      }
    } else {
      console.log('✅ LLM data already provided, skipping check-llm call');
    }

    // ==================== ÉTAPE 2: LLM ANALYSIS ====================
    console.log('\n🤖 ÉTAPE 2: Analyse LLM...');
    
    let userPrompt = buildUserPrompt(url, domain, effectiveToolsData, marketData, pageContentContext);
    
    // Inject brand name instruction (compact)
    userPrompt = `⚠️ NOM ENTREPRISE: "${humanBrandName}" (pas "${domainSlug}"). Utilise TOUJOURS "${humanBrandName}".\n` + userPrompt;
    
    if (localCompetitorData) {
      userPrompt = `🏙️ CONCURRENT LOCAL SERP: "${localCompetitorData.name}" URL:${localCompetitorData.url} Position:${localCompetitorData.rank}. Utilise comme direct_competitor.\n` + userPrompt;
    }
    
    if (hallucinationCorrections) {
      const corrections = Object.entries(hallucinationCorrections)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}="${v}"`)
        .join(', ');
      if (corrections) {
        userPrompt = `⚠️ CORRECTIONS UTILISATEUR (priorité absolue): ${corrections}\n` + userPrompt;
      }
    }
    
    if (competitorCorrections) {
      const cc = competitorCorrections;
      const parts: string[] = [];
      if (cc.leader?.name) parts.push(`Leader:"${cc.leader.name}"${cc.leader.url ? `(${cc.leader.url})` : ''}`);
      if (cc.direct_competitor?.name) parts.push(`Concurrent:"${cc.direct_competitor.name}"${cc.direct_competitor.url ? `(${cc.direct_competitor.url})` : ''}`);
      if (cc.challenger?.name) parts.push(`Challenger:"${cc.challenger.name}"`);
      if (parts.length > 0) {
        userPrompt = `🏢 CONCURRENTS CORRIGÉS: ${parts.join(', ')}\n` + userPrompt;
      }
    }
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: 'AI credits exhausted.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText.substring(0, 200));
      return new Response(JSON.stringify({ success: false, error: 'AI analysis failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    trackTokenUsage('audit-strategique-ia', 'google/gemini-2.5-flash', aiResponse.usage, url);

    if (!content) {
      return new Response(JSON.stringify({ success: false, error: 'Empty AI response' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== PARSE JSON ====================
    console.log('\n📝 Parsing...');
    let parsedAnalysis;
    try {
      let jsonContent = content;
      if (content.includes('```json')) jsonContent = content.split('```json')[1].split('```')[0].trim();
      else if (content.includes('```')) jsonContent = content.split('```')[1].split('```')[0].trim();
      jsonContent = jsonContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      parsedAnalysis = JSON.parse(jsonContent);
    } catch {
      try {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          let jsonContent = content.substring(firstBrace, lastBrace + 1);
          jsonContent = jsonContent.replace(/,(\s*[\}\]])/g, '$1');
          parsedAnalysis = JSON.parse(jsonContent);
        } else throw new Error('No JSON found');
      } catch {
        return new Response(JSON.stringify({ success: false, error: 'Failed to parse AI analysis' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Sanitize brand name
    parsedAnalysis = sanitizeBrandNameInResponse(parsedAnalysis, domainSlug, humanBrandName);

    const result = {
      success: true,
      data: {
        url, domain,
        scannedAt: new Date().toISOString(),
        ...parsedAnalysis,
        raw_market_data: marketData,
        toolsData: null, // Don't echo back the full toolsData to save response size
        llm_visibility_raw: effectiveToolsData.llm,
      }
    };

    console.log('✅ AUDIT TERMINÉ');

    // Save to registry (fire and forget)
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (authHeader && supabaseUrl && supabaseKey) {
      saveStrategicRecommendationsToRegistry(supabaseUrl, supabaseKey, authHeader, domain, url, parsedAnalysis)
        .catch(err => console.error('Registre:', err));
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate audit' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
