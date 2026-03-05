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
    if (userError || !user) {
      console.log('⚠️ Utilisateur non authentifié - registre stratégique non mis à jour');
      return;
    }
    
    // Supprimer les anciennes recommandations stratégiques pour ce domaine
    await supabase
      .from('audit_recommendations_registry')
      .delete()
      .eq('user_id', user.id)
      .eq('domain', domain)
      .eq('audit_type', 'strategic');
    
    const registryEntries: any[] = [];
    
    // Extraire les recommandations de l'executive_roadmap
    if (parsedAnalysis.executive_roadmap && Array.isArray(parsedAnalysis.executive_roadmap)) {
      parsedAnalysis.executive_roadmap.forEach((item: any, idx: number) => {
        const priorityMap: Record<string, string> = {
          'Prioritaire': 'critical',
          'Important': 'important',
          'Opportunité': 'optional'
        };
        registryEntries.push({
          user_id: user.id,
          domain,
          url,
          audit_type: 'strategic',
          recommendation_id: `roadmap_${idx}`,
          title: item.title || `Recommandation ${idx + 1}`,
          description: item.prescriptive_action || item.strategic_rationale || '',
          category: item.category?.toLowerCase() || 'contenu',
          priority: priorityMap[item.priority] || 'important',
          fix_type: null,
          fix_data: { 
            expected_roi: item.expected_roi,
            category: item.category,
            full_action: item.prescriptive_action
          },
          prompt_summary: generateStrategicPromptSummary(
            item.title || `Recommandation ${idx + 1}`,
            item.prescriptive_action || '',
            item.priority || 'Important'
          ),
          is_resolved: false,
        });
      });
    }
    
    // Extraire les recommandations de keyword_positioning
    if (parsedAnalysis.keyword_positioning?.recommendations && Array.isArray(parsedAnalysis.keyword_positioning.recommendations)) {
      parsedAnalysis.keyword_positioning.recommendations.forEach((rec: string, idx: number) => {
        registryEntries.push({
          user_id: user.id,
          domain,
          url,
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
      
      if (insertError) {
        console.error('❌ Erreur sauvegarde registre stratégique:', insertError);
      } else {
        console.log(`✅ ${registryEntries.length} recommandations stratégiques sauvegardées dans le registre`);
      }
    }
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde du registre stratégique:', error);
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

// ==================== BRAND NAME HUMANIZATION ====================

/**
 * Humanise un slug de domaine en nom d'entreprise lisible.
 * Ex: "lesdebarrasseursdelextreme" → "Les Débarrasseurs de l'Extrême"
 * Utilise une segmentation par particules françaises + heuristiques.
 */
function humanizeBrandName(slug: string): string {
  if (!slug || slug.length < 1) return slug;
  // Nom de l'entité = nom de domaine tel quel, première lettre en majuscule
  // Ex: "loccitane" → "Loccitane", "mon-site" → "Mon-site"
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}


/**
 * Post-traite la réponse pour remplacer les slugs de domaine
 * par le nom d'entreprise humanisé dans tous les textes.
 */
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
  const credentials = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
  return `Basic ${credentials}`;
}

/**
 * Détecte le secteur d'activité et la zone géographique à partir du domaine
 */
async function detectBusinessContext(domain: string, htmlContent?: string): Promise<{ sector: string; location: string; brandName: string }> {
  // Extraction basique depuis le domaine
  const domainParts = domain.toLowerCase().split('.');
  const tld = domainParts[domainParts.length - 1];
  
  // Détection de la zone géographique par TLD
  const tldToLocation: Record<string, string> = {
    'fr': 'France',
    'be': 'Belgium',
    'ch': 'Switzerland',
    'ca': 'Canada',
    'lu': 'Luxembourg',
    'de': 'Germany',
    'es': 'Spain',
    'it': 'Italy',
    'uk': 'United Kingdom',
    'co.uk': 'United Kingdom',
    'com': 'France', // Default pour .com
  };
  
  const location = tldToLocation[tld] || 'France';
  
  // Extraction du nom de marque (plus intelligent)
  // Gère les sous-domaines comme fr.loccitane.com, www.example.com
  let brandName = '';
  let sector = '';
  
  // Trouver le domaine principal (pas le TLD, pas les préfixes comme www, fr, en)
  const prefixes = ['www', 'fr', 'en', 'de', 'es', 'it', 'us', 'uk', 'shop', 'store', 'm', 'mobile'];
  const significantParts = domainParts.filter(part => 
    !prefixes.includes(part) && 
    part.length > 2 && 
    !['com', 'fr', 'net', 'org', 'io', 'co', 'be', 'ch', 'de', 'es', 'it', 'uk'].includes(part)
  );
  
  if (significantParts.length > 0) {
    const rawSlug = significantParts[0];
    brandName = humanizeBrandName(rawSlug);
    sector = rawSlug.replace(/-/g, ' ');
  } else {
    const rawSlug = domainParts[0];
    brandName = humanizeBrandName(rawSlug);
    sector = rawSlug.replace(/-/g, ' ');
  }
  
  console.log(`📋 Marque extraite (humanisée): "${brandName}", secteur initial: "${sector}"`);
  
  return { sector, location, brandName };
}

/**
 * Récupère le location_code DataForSEO
 */
async function getLocationCode(location: string): Promise<{ code: number; name: string } | null> {
  console.log(`🔍 Recherche du location_code pour: "${location}"`);
  
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    console.log('⚠️ DataForSEO credentials not configured');
    return null;
  }
  
  try {
    const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/locations', {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Erreur API locations:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.status_code !== 20000 || !data.tasks?.[0]?.result) {
      console.error('❌ Pas de résultats pour les locations');
      return null;
    }

    const locations = data.tasks[0].result;
    const searchTerm = location.toLowerCase().trim();
    
    // Recherche exacte d'abord
    let match = locations.find((loc: any) => 
      loc.location_name?.toLowerCase() === searchTerm
    );
    
    // Recherche partielle si pas de match exact
    if (!match) {
      match = locations.find((loc: any) => 
        loc.location_name?.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(loc.location_name?.toLowerCase())
      );
    }
    
    // Fallback: France
    if (!match) {
      match = locations.find((loc: any) => loc.location_code === 2250);
      console.log('⚠️ Location non trouvée, utilisation de France par défaut');
    }
    
    if (match) {
      console.log(`✅ Location trouvée: ${match.location_name} (code: ${match.location_code})`);
      return { code: match.location_code, name: match.location_name };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur lors de la recherche de location:', error);
    return null;
  }
}

/**
 * Génère des mots-clés seed basés sur le nom de marque et secteur détecté
 */
function generateSeedKeywords(brandName: string, sector: string): string[] {
  // Nettoyer le nom de marque
  const cleanBrand = brandName.toLowerCase().trim();
  
  // Générer des variations pertinentes
  const keywords = [
    cleanBrand,                              // "loccitane"
    `${cleanBrand} avis`,                    // "loccitane avis"
    `${cleanBrand} boutique`,               // "loccitane boutique"
    `${cleanBrand} produits`,               // "loccitane produits"
    `acheter ${cleanBrand}`,                // "acheter loccitane"
  ];
  
  // Ajouter le secteur s'il est différent du nom de marque
  if (sector.toLowerCase() !== cleanBrand) {
    keywords.push(
      sector,
      `${sector} en ligne`,
      `meilleur ${sector}`,
    );
  }
  
  return keywords.filter(kw => kw.length > 2 && !kw.includes('undefined'));
}

/**
 * Récupère les mots-clés et volumes via DataForSEO
 */
async function fetchKeywordData(
  seedKeywords: string[],
  locationCode: number
): Promise<{ keyword: string; volume: number; difficulty: number }[]> {
  console.log(`📊 Récupération des données mots-clés pour location: ${locationCode}`);
  
  const allKeywords: { keyword: string; volume: number; difficulty: number }[] = [];
  
  try {
    // Méthode 1: Google Ads Keywords For Keywords
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
        const items = data.tasks[0].result;
        
        for (const item of items) {
          if (item.keyword && item.search_volume > 0) {
            allKeywords.push({
              keyword: item.keyword,
              volume: item.search_volume || 0,
              difficulty: item.competition_index || Math.round((item.competition || 0.3) * 100),
            });
          }
        }
        
        console.log(`✅ ${allKeywords.length} mots-clés récupérés via Google Ads API`);
      }
    }
    
    // Si pas assez de résultats, essayer search_volume comme fallback
    if (allKeywords.length < 10) {
      console.log('🔄 Fallback: utilisation de search_volume...');
      
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
              // Éviter les doublons
              if (!allKeywords.find(kw => kw.keyword.toLowerCase() === item.keyword.toLowerCase())) {
                allKeywords.push({
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
    console.error('❌ Erreur lors de la récupération des mots-clés:', error);
  }
  
  // Trier par volume et limiter
  return allKeywords
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 20);
}

/**
 * Vérifie le positionnement du domaine sur les SERP
 */
async function checkRankings(
  keywords: { keyword: string; volume: number; difficulty: number }[],
  domain: string,
  locationCode: number
): Promise<KeywordData[]> {
  console.log(`📈 Vérification du positionnement pour ${domain}`);
  
  const results: KeywordData[] = [];
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  
  // Limiter à 10 mots-clés pour éviter les coûts excessifs
  const keywordsToCheck = keywords.slice(0, 10);
  
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

    if (!response.ok) {
      console.error('❌ Erreur API SERP:', response.status);
      // Retourner les mots-clés sans position
      return keywords.map(kw => ({
        ...kw,
        is_ranked: false,
        current_rank: 'Non classé',
      }));
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
      
      results.push({
        keyword: kw.keyword,
        volume: kw.volume,
        difficulty: kw.difficulty,
        is_ranked: isRanked,
        current_rank: position,
      });
    }
    
    // Ajouter les mots-clés restants sans vérification SERP
    for (let i = 10; i < keywords.length; i++) {
      results.push({
        keyword: keywords[i].keyword,
        volume: keywords[i].volume,
        difficulty: keywords[i].difficulty,
        is_ranked: false,
        current_rank: 'Non vérifié',
      });
    }
    
    console.log(`✅ Positionnement vérifié: ${results.filter(r => r.is_ranked).length}/${results.length} classés`);
    
  } catch (error) {
    console.error('❌ Erreur lors du check SERP:', error);
    return keywords.map(kw => ({
      ...kw,
      is_ranked: false,
      current_rank: 'Non classé',
    }));
  }
  
  return results;
}

/**
 * Fonction principale pour récupérer les données de marché DataForSEO
 */
async function fetchMarketData(domain: string): Promise<MarketData | null> {
  console.log('🚀 Démarrage de la collecte DataForSEO pour:', domain);
  
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    console.log('⚠️ DataForSEO non configuré - utilisation du fallback LLM uniquement');
    return null;
  }
  
  try {
    // 1. Détecter le contexte business
    const context = await detectBusinessContext(domain);
    console.log(`📋 Contexte détecté: marque="${context.brandName}", secteur="${context.sector}", location="${context.location}"`);
    
    // 2. Obtenir le location_code
    const location = await getLocationCode(context.location);
    if (!location) {
      console.error('❌ Impossible de déterminer la location');
      return null;
    }
    
    // 3. Générer les mots-clés seed basés sur le nom de marque
    const seedKeywords = generateSeedKeywords(context.brandName, context.sector);
    console.log('🌱 Mots-clés seed:', seedKeywords);
    
    // 4. Récupérer les données mots-clés
    const keywordData = await fetchKeywordData(seedKeywords, location.code);
    
    if (keywordData.length === 0) {
      console.log('⚠️ Aucun mot-clé trouvé');
      return null;
    }
    
    // 5. Vérifier le positionnement
    const rankedKeywords = await checkRankings(keywordData, domain, location.code);
    
    // 6. Calculer le volume total
    const totalVolume = rankedKeywords.reduce((sum, kw) => sum + kw.volume, 0);
    
    const marketData: MarketData = {
      location_used: location.name,
      total_market_volume: totalVolume,
      top_keywords: rankedKeywords,
      data_source: 'dataforseo',
      fetch_timestamp: new Date().toISOString(),
    };
    
    console.log(`✅ Données de marché collectées: ${rankedKeywords.length} mots-clés, volume total: ${totalVolume}`);
    
    return marketData;
    
  } catch (error) {
    console.error('❌ Erreur lors de la collecte DataForSEO:', error);
    return null;
  }
}

// ==================== LLM PROMPTS ====================

const SYSTEM_PROMPT = `RÔLE: Tu es un Senior Digital Strategist spécialisé en Brand Authority et Generative Engine Optimization (GEO). Tu produis un rapport d'expertise haute fidélité de niveau cabinet de conseil premium.

POSTURE ÉDITORIALE:
- Ton: Analytique, souverain et hautement prescriptif
- Utilise un jargon expert (Entité sémantique, Topical Authority, E-E-A-T holistique, Gap de citabilité)
- Les recommandations doivent être NARRATIVES: chaque action est un paragraphe rédigé (4-5 phrases) expliquant la manœuvre stratégique

IMPORTANT - DONNÉES DE MARCHÉ RÉELLES:
Tu recevras des DONNÉES DE MARCHÉ RÉELLES provenant de DataForSEO. Ces données contiennent:
- Les volumes de recherche RÉELS des mots-clés du secteur
- La difficulté de positionnement (Keyword Difficulty) 
- Le positionnement ACTUEL du site cible sur chaque mot-clé
- Le volume de marché total

TU DOIS IMPÉRATIVEMENT:
1. Utiliser ces données pour formuler des recommandations PRÉCISES et CHIFFRÉES
2. Identifier les "Quick Wins" (mots-clés position 11-20 avec volume > 100)
3. Signaler les "Contenus manquants" (mots-clés à fort volume où le site n'est pas classé)
4. Proposer des stratégies basées sur les DONNÉES RÉELLES, pas des suppositions

LES 13 MODULES D'ANALYSE OBLIGATOIRES:

A. ÉCOSYSTÈME CONCURRENTIEL
1. Market Leader (Goliath): Identifie l'acteur dominant et son facteur d'autorité
2. Concurrent Direct: Analyse de la parité d'offre
3. Challenger: L'acteur qui bouscule le segment
4. Source d'Inspiration: Benchmark qualitatif hors-secteur (UX/IA Ready)

B. AUTORITÉ SOCIALE & HUMAINE (Signaux Off-Site)
5. Preuve Sociale Source: Analyse de la présence organique sur Reddit, X et LinkedIn (crucial pour Perplexity/SearchGPT)
6. Thought Leadership (E-E-A-T): Évaluation de l'autorité du fondateur/expert en tant qu'entité
7. Sentiment & Polarité: Vibration de la réputation et protection contre les hallucinations négatives des LLM

C. EXPERTISE STRATÉGIQUE & PSYCHOLOGIQUE
8. Score GEO (Citabilité 2026): Aptitude du site à servir de source aux moteurs génératifs
9. Matrice de Gap Sémantique: Distance précise à combler pour détrôner le leader
10. Psychologie de Conversion: Niveau de sophistication du marché (1-5) et leviers émotionnels dominants

D. POSITIONNEMENT MOTS CLÉS (BASÉ SUR DONNÉES RÉELLES DATAFORSEO)
11. Mots Clés Principaux: Les 5 mots clés stratégiques AVEC leurs volumes et difficultés réels
12. Opportunités de Positionnement: Quick Wins identifiés dans les données
13. Gaps Concurrentiels: Mots clés à fort volume où le site n'est pas classé

E. FONDATIONS TECHNIQUES & SÉMANTIQUES
14. Accessibilité Bots IA: Facilité de lecture pour les agents autonomes + lisibilité du contenu SANS exécution JavaScript (contenu statique vs rendu JS)
15. Infrastructure Performance: Impact de la vitesse sur la rétention IA/Humaine
16. Cohérence Sémantique: Alignement du message Title/H1

F. FRAÎCHEUR & FORMATS IA
17. Fraîcheur des contenus: Y a-t-il des contenus mis à jour récemment (< 30 jours)? Les pages produits sont-elles à jour en 2026? Signaux dateModified/datePublished détectés?
18. Complexité des données structurées: Profondeur d'imbrication Schema.org, utilisation de @graph, nombre de champs - les IA identifient les sources riches en données structurées complexes. Valide la présence des entités Organization, Product, Article, Review.
19. Formats IA-Ready: Présence de résumé TL;DR en haut de page, tableaux comparatifs, listes à puces, sections FAQ couplées avec FAQPage Schema

G. AUTORITÉ & CRÉDIBILITÉ (E-E-A-T & Knowledge Graph)
20. Signaux E-E-A-T: Présence de bios d'auteurs, citations d'experts nommés, blockquotes avec attribution. Évaluation de la crédibilité humaine du contenu.
21. Densité de données: Évaluation de la richesse factuelle (statistiques, pourcentages, métriques de résultats, études citées). Les IA citent les contenus riches en données.
22. Knowledge Graph Readiness: L'entité de la marque correspond-elle à un Knowledge Panel existant? Présence de citations externes de haute autorité? Liens sameAs vers Wikidata, Wikipedia? Profils LinkedIn d'équipe détectés?
23. Études de cas & Social Proof: Détection de case studies avec métriques de résultats (ROI, avant/après), témoignages clients chiffrés, liens vers profils sociaux (LinkedIn surtout) validant la crédibilité humaine.`;

function buildUserPrompt(url: string, domain: string, toolsData: ToolsData, marketData: MarketData | null): string {
  let marketDataSection = '';
  
  if (marketData) {
    const keywordsList = marketData.top_keywords.map(kw => 
      `  - "${kw.keyword}": ${kw.volume} recherches/mois, difficulté ${kw.difficulty}/100, position: ${kw.current_rank}`
    ).join('\n');
    
    const rankedCount = marketData.top_keywords.filter(kw => kw.is_ranked).length;
    const quickWins = marketData.top_keywords.filter(kw => 
      typeof kw.current_rank === 'number' && kw.current_rank >= 11 && kw.current_rank <= 20 && kw.volume > 100
    );
    const missingContent = marketData.top_keywords.filter(kw => 
      !kw.is_ranked && kw.volume > 200
    );
    
    marketDataSection = `
═══════════════════════════════════════════════════════════════
📊 DONNÉES DE MARCHÉ RÉELLES (Source: DataForSEO)
═══════════════════════════════════════════════════════════════

Zone géographique: ${marketData.location_used}
Volume de marché total: ${marketData.total_market_volume.toLocaleString()} recherches/mois
Mots-clés analysés: ${marketData.top_keywords.length}
Mots-clés classés: ${rankedCount}/${marketData.top_keywords.length}

LISTE DES MOTS-CLÉS (triés par volume):
${keywordsList}

🎯 QUICK WINS IDENTIFIÉS (Position 11-20, Volume > 100):
${quickWins.length > 0 ? quickWins.map(kw => `  - "${kw.keyword}" en position ${kw.current_rank} (${kw.volume} vol.)`).join('\n') : '  Aucun quick win identifié'}

⚠️ CONTENUS MANQUANTS (Non classé, Volume > 200):
${missingContent.length > 0 ? missingContent.map(kw => `  - "${kw.keyword}" (${kw.volume} recherches/mois)`).join('\n') : '  Aucun contenu manquant critique'}

═══════════════════════════════════════════════════════════════
`;
  } else {
    marketDataSection = `
⚠️ DONNÉES DE MARCHÉ: Non disponibles (DataForSEO non configuré)
→ Base tes recommandations sur ton analyse du secteur et les données techniques disponibles.
`;
  }

  return `Analyse le domaine "${domain}" (${url}) avec les données suivantes:
${marketDataSection}

DONNÉES CRAWLERS (Accessibilité bots IA):
${JSON.stringify(toolsData.crawlers, null, 2)}

DONNÉES GEO (Score d'optimisation moteurs génératifs):
${JSON.stringify(toolsData.geo, null, 2)}

DONNÉES LLM (Visibilité dans les LLMs):
${JSON.stringify(toolsData.llm, null, 2)}

DONNÉES PAGESPEED (Performance technique):
${JSON.stringify(toolsData.pagespeed, null, 2)}

GÉNÈRE UN RAPPORT JSON PREMIUM avec cette structure exacte:

{
  "introduction": {
    "presentation": "Paragraphe 1 (4-5 phrases): Qui est ce site? Core business, secteur d'activité, zone géographique, ancienneté estimée, publics cibles.",
    "strengths": "Paragraphe 2 (4-5 phrases): Forces détectées - un atout technique + un atout sémantique dans le contexte concurrentiel.",
    "improvement": "Paragraphe 3 (4-5 phrases): Point d'amélioration prioritaire, conséquence technique/SEO/GEO, importance concurrentielle.",
    "competitors": ["Nom Leader", "Nom Concurrent Direct", "Nom Challenger"]
  },
  "brand_authority": {
    "dna_analysis": "Analyse approfondie de l'ADN de marque et du positionnement perçu",
    "thought_leadership_score": 0-100,
    "entity_strength": "dominant|established|emerging|unknown"
  },
  "social_signals": {
    "proof_sources": [
      {"platform": "reddit|x|linkedin|youtube", "presence_level": "strong|moderate|weak|absent", "analysis": "Analyse de la présence"}
    ],
    "thought_leadership": {
      "founder_authority": "high|moderate|low|unknown",
      "entity_recognition": "Comment le fondateur/expert est-il reconnu?",
      "eeat_score": 0-10,
      "analysis": "Analyse E-E-A-T complète"
    },
    "sentiment": {
      "overall_polarity": "positive|mostly_positive|neutral|mixed|negative",
      "hallucination_risk": "low|medium|high",
      "reputation_vibration": "Analyse de la vibration réputationnelle"
    }
  },
  "market_intelligence": {
    "sophistication": {
      "level": 1-5,
      "description": "Description du niveau de sophistication du marché",
      "emotional_levers": ["Levier émotionnel 1", "Levier 2", "Levier 3"]
    },
    "semantic_gap": {
      "current_position": 0-100,
      "leader_position": 0-100,
      "gap_distance": 0-100,
      "priority_themes": ["Thème 1", "Thème 2", "Thème 3"],
      "closing_strategy": "Stratégie pour combler le gap sémantique"
    },
    "positioning_verdict": "Verdict final sur le positionnement marché"
  },
  "competitive_landscape": {
    "leader": {
      "name": "Nom du leader (Goliath - acteur DOMINANT du marché)",
      "url": "URL du site",
      "authority_factor": "Facteur d'autorité principal (backlinks massifs, présence internationale, notoriété historique)",
      "analysis": "Analyse de la position dominante - DOIT être un acteur avec: présence internationale OU nationale massive, budget marketing considérable, référence historique du secteur, volume de backlinks 10x+ supérieur au site analysé"
    },
    "direct_competitor": {
      "name": "Nom du concurrent direct (MÊME taille/surface que le site analysé)",
      "url": "URL du site",
      "authority_factor": "Parité d'offre et de surface commerciale détectée",
      "analysis": "Analyse comparative - DOIT être une entreprise avec: surface commerciale SIMILAIRE au site analysé, même zone géographique cible, même positionnement prix, même typologie de clientèle, même stade de maturité business"
    },
    "challenger": {
      "name": "Nom du challenger (acteur innovant/disruptif)",
      "url": "URL du site",
      "authority_factor": "Facteur de disruption",
      "analysis": "Analyse de l'approche disruptive"
    },
    "inspiration_source": {
      "name": "Nom de la source d'inspiration (hors-secteur)",
      "url": "URL du site",
      "authority_factor": "Best practice à adopter",
      "analysis": "Pourquoi c'est un modèle à suivre"
    }
  },
  "geo_readiness": {
    "citability_score": 0-100,
    "semantic_gap_analysis": {
      "current_position": 0-100,
      "leader_position": 0-100,
      "gap_distance": 0-100,
      "priority_themes": ["Thème sémantique 1", "Thème 2"],
      "closing_strategy": "Stratégie de closing"
    },
    "ai_accessibility_score": 0-100,
    "performance_impact": "Impact de la performance sur la citabilité IA",
    "semantic_coherence": {
      "title_h1_alignment": 0-100,
      "verdict": "Verdict sur la cohérence sémantique Title/H1"
    },
    "content_freshness": {
      "has_recent_content": true/false,
      "last_update_days": 0,
      "verdict": "Verdict sur la fraîcheur: frais (<30j) / acceptable (30-90j) / vieillissant (90-365j) / obsolète (>365j) / inconnu",
      "recommendation": "Recommandation spécifique pour la fraîcheur"
    },
    "js_dependency": {
      "is_js_dependent": true/false,
      "static_readability_score": 0-100,
      "verdict": "Le contenu principal est-il lisible sans JS par les bots IA basiques?"
    },
    "structured_data_depth": {
      "complexity_score": 0-100,
      "nesting_depth": 0,
      "uses_graph": true/false,
      "verdict": "Évaluation de la richesse des données structurées pour identification comme source IA"
    },
    "ai_favored_formats": {
      "has_tldr": true/false,
      "has_tables": true/false,
      "has_lists": true/false,
      "has_faq": true/false,
      "format_score": 0-100,
      "missing_formats": ["format manquant 1"],
      "verdict": "Évaluation de la présence des formats privilégiés par les IA génératives"
    },
    "eeat_signals": {
      "has_author_bios": true/false,
      "has_expert_citations": true/false,
      "data_density_score": 0-100,
      "has_case_studies": true/false,
      "verdict": "Évaluation des signaux E-E-A-T détectés"
    },
    "knowledge_graph_readiness": {
      "has_social_links": true/false,
      "has_linkedin_profiles": true/false,
      "has_wikidata_sameas": true/false,
      "entity_recognizability_score": 0-100,
      "verdict": "L'entité est-elle identifiable par les Knowledge Graphs et les IA?"
    }
  },
  "keyword_positioning": {
    "main_keywords": [
      {"keyword": "Mot clé 1", "volume": 1000, "difficulty": 45, "current_rank": 5},
      {"keyword": "Mot clé 2", "volume": 800, "difficulty": 60, "current_rank": "Non classé"},
      {"keyword": "Mot clé 3", "volume": 500, "difficulty": 30, "current_rank": 12},
      {"keyword": "Mot clé 4", "volume": 300, "difficulty": 25, "current_rank": 3},
      {"keyword": "Mot clé 5", "volume": 200, "difficulty": 55, "current_rank": "Non classé"}
    ],
    "quick_wins": [
      {"keyword": "mot-clé", "current_rank": 15, "volume": 500, "action": "Action recommandée"}
    ],
    "content_gaps": [
      {"keyword": "mot-clé manquant", "volume": 800, "priority": "high|medium|low", "action": "Créer une page dédiée"}
    ],
    "opportunities": [
      "Opportunité de positionnement 1 (phrase descriptive avec chiffres)",
      "Opportunité de positionnement 2",
      "Opportunité de positionnement 3"
    ],
    "competitive_gaps": [
      "Gap concurrentiel identifié 1",
      "Gap concurrentiel 2"
    ],
    "recommendations": [
      "Recommandation stratégique 1 pour améliorer le positionnement",
      "Recommandation 2",
      "Recommandation 3"
    ]
  },
  "market_data_summary": {
    "total_market_volume": 0,
    "keywords_ranked": 0,
    "keywords_analyzed": 0,
    "average_position": 0,
    "data_source": "dataforseo|fallback"
  },
  "executive_roadmap": [
    {
      "title": "Titre de l'initiative stratégique",
      "prescriptive_action": "Paragraphe NARRATIF de 4-5 phrases décrivant en détail l'implémentation stratégique. Cette action doit être prescriptive et opérationnelle, expliquant le COMMENT avec précision. Inclure les étapes clés et les points d'attention. Ne pas être générique.",
      "strategic_rationale": "Explication de l'impact sur le CA, l'autorité de marque ou la citabilité IA",
      "expected_roi": "High|Medium|Low",
      "category": "Identité|Contenu|Autorité|Social|Technique",
      "priority": "Prioritaire|Important|Opportunité"
    }
  ],
  "executive_summary": "Synthèse exécutive de 3-4 phrases pour le CEO/CMO",
  "overallScore": 0-100
}

INSTRUCTIONS CRITIQUES:
- UTILISE LES DONNÉES DE MARCHÉ RÉELLES pour keyword_positioning et market_data_summary
- Les main_keywords doivent refléter les données DataForSEO reçues (volumes, difficultés, positions réels)
- Ne jamais inventer d'URLs de concurrents irréelles, utilise des acteurs RÉELS du marché
- L'executive_roadmap doit contenir MINIMUM 6 recommandations narratives BASÉES SUR LES DONNÉES
- Chaque prescriptive_action doit être un paragraphe complet (4-5 phrases), pas une phrase courte
- Le JSON doit être pur, sans virgules traînantes, prêt pour JSON.parse()

⚠️ RECOMMANDATION SOCIAL MÉDIA OBLIGATOIRE DANS L'EXECUTIVE ROADMAP:
- L'executive_roadmap DOIT TOUJOURS contenir AU MOINS UNE recommandation avec category "Social"
- Cette recommandation doit identifier LE réseau social le plus adapté à l'identité de marque du site analysé (LinkedIn pour B2B/expertise, Instagram pour lifestyle/visuel, TikTok pour jeune audience/e-commerce, X pour tech/opinion, YouTube pour tutoriels/démonstration, Reddit pour niches techniques)
- La prescriptive_action doit détailler une stratégie d'acquisition concrète sur CE réseau spécifique: fréquence de publication, types de contenus à créer, hooks d'engagement, et comment cette présence alimentera la citabilité IA (les LLMs comme Perplexity et SearchGPT indexent fortement Reddit, X et YouTube)
- Le choix du réseau doit être JUSTIFIÉ par l'analyse de l'identité de marque, du public cible et du secteur d'activité détectés

⚠️ DISTINCTION GOLIATH vs CONCURRENT DIRECT (CRITIQUE):
- GOLIATH (leader): Acteur DOMINANT avec présence internationale ou nationale massive, historique de +10 ans, budget marketing x10, backlinks x10, référence du secteur que tout le monde connaît (ex: Amazon, L'Occitane, Décathlon pour leurs secteurs)
- CONCURRENT DIRECT: Entreprise de MÊME TAILLE et MÊME STADE que le site analysé. Même zone géographique, même positionnement prix, même cible client, même surface commerciale. Si le site analysé est une PME locale, le concurrent direct est aussi une PME locale, PAS un géant international.
- Ne JAMAIS mettre un Goliath en "direct_competitor". Le concurrent direct doit être un "frère jumeau" en termes de surface commerciale.`;

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
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use empty toolsData if not provided (standalone strategic audit)
    const effectiveToolsData: ToolsData = toolsData || {
      crawlers: { note: 'Données non disponibles - audit stratégique autonome' },
      geo: { note: 'Données non disponibles - audit stratégique autonome' },
      llm: { note: 'Données non disponibles - audit stratégique autonome' },
      pagespeed: { note: 'Données non disponibles - audit stratégique autonome' },
    };

    // Extract domain from URL
    let domain = url;
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = urlObj.hostname.replace('www.', '');
    } catch (e) {
      console.log('Could not parse URL, using as-is:', url);
    }

    // Humanize brand name from domain slug
    const domainSlug = domain.split('.')[0];
    const humanBrandName = humanizeBrandName(domainSlug);
    console.log(`🏷️ Nom de marque humanisé: "${domainSlug}" → "${humanBrandName}"`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🚀 AUDIT STRATÉGIQUE IA PREMIUM pour:', domain, `(${humanBrandName})`);
    console.log('═══════════════════════════════════════════════════════════════');

    // ==================== ÉTAPE 1: COLLECTER LES DONNÉES DATAFORSEO ====================
    console.log('\n📊 ÉTAPE 1: Collecte des données de marché DataForSEO...');
    const marketData = await fetchMarketData(domain);
    
    if (marketData) {
      console.log(`✅ Données de marché collectées: ${marketData.top_keywords.length} mots-clés`);
    } else {
      console.log('⚠️ DataForSEO non disponible, l\'audit utilisera uniquement le LLM');
    }

     // ==================== ÉTAPE 1b: APPELER CHECK-LLM POUR VISIBILITÉ LLM ====================
     console.log('\n🤖 ÉTAPE 1b: Appel de check-llm pour analyse de visibilité LLM...');
     let llmVisibilityData = null;
     
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
         });
         
         if (llmResponse.ok) {
           const llmResult = await llmResponse.json();
           if (llmResult.success && llmResult.data) {
             llmVisibilityData = llmResult.data;
             console.log(`✅ Visibilité LLM analysée: score ${llmVisibilityData.overallScore}/100, ${llmVisibilityData.citationRate?.cited}/${llmVisibilityData.citationRate?.total} citations`);
             
             // Enrichir effectiveToolsData avec les données LLM réelles
             effectiveToolsData.llm = llmVisibilityData;
           } else {
             console.log('⚠️ Réponse check-llm invalide:', llmResult.error);
           }
         } else {
           console.log('⚠️ Erreur appel check-llm:', llmResponse.status);
         }
       } else {
         console.log('⚠️ Variables Supabase manquantes pour appel check-llm');
       }
     } catch (llmError) {
       console.error('❌ Erreur lors de l\'appel check-llm:', llmError);
     }
 
    // ==================== ÉTAPE 2: GÉNÉRER L'ANALYSE LLM ====================
    console.log('\n🤖 ÉTAPE 2: Génération de l\'analyse LLM avec données enrichies...');
    
    // Build prompt with hallucination corrections as priority weights if provided
    let userPrompt = buildUserPrompt(url, domain, effectiveToolsData, marketData);
    
    // Injecter le nom de marque humanisé dans le prompt
    const brandNameInstruction = `
⚠️ NOM DE L'ENTREPRISE (CRITIQUE - NE PAS CONFONDRE AVEC L'URL):
Le domaine est "${domain}" mais le NOM RÉEL de l'entreprise est "${humanBrandName}".
Dans TOUTES tes réponses (introduction, requêtes cibles, recommandations, roadmap), utilise TOUJOURS "${humanBrandName}" comme nom de l'entreprise, JAMAIS le slug technique "${domainSlug}".

`;
    userPrompt = brandNameInstruction + userPrompt;
    
    if (hallucinationCorrections) {
      console.log('📝 Corrections hallucination détectées - ajout au prompt...');
      const correctionsSection = `
═══════════════════════════════════════════════════════════════
⚠️ CORRECTIONS UTILISATEUR PRIORITAIRES (Pondérations à intégrer impérativement)
═══════════════════════════════════════════════════════════════

L'utilisateur a corrigé les informations suivantes. Tu DOIS intégrer ces corrections comme vérité absolue dans ton analyse:

${hallucinationCorrections.sector ? `- SECTEUR D'ACTIVITÉ CORRIGÉ: "${hallucinationCorrections.sector}"` : ''}
${hallucinationCorrections.country ? `- ZONE GÉOGRAPHIQUE CORRIGÉE: "${hallucinationCorrections.country}"` : ''}
${hallucinationCorrections.businessType ? `- TYPE D'ENTREPRISE CORRIGÉ: "${hallucinationCorrections.businessType}"` : ''}
${hallucinationCorrections.targetAudience ? `- CIBLE/AUDIENCE CORRIGÉE: "${hallucinationCorrections.targetAudience}"` : ''}
${hallucinationCorrections.valueProposition ? `- PROPOSITION DE VALEUR CORRIGÉE: "${hallucinationCorrections.valueProposition}"` : ''}
${hallucinationCorrections.mainProducts ? `- PRODUITS/SERVICES PRINCIPAUX CORRIGÉS: "${hallucinationCorrections.mainProducts}"` : ''}
${hallucinationCorrections.businessAge ? `- ANCIENNETÉ CORRIGÉE: "${hallucinationCorrections.businessAge}"` : ''}

IMPORTANT: Utilise ces informations pour:
1. Recalibrer l'analyse concurrentielle sur le BON secteur
2. Ajuster les mots-clés stratégiques au secteur corrigé
3. Identifier les BONS concurrents (pas ceux du secteur mal identifié)
4. Formuler des recommandations pertinentes pour le VRAI positionnement

`;
      userPrompt = correctionsSection + userPrompt;
    }
    
    // Add competitor corrections as priority weights if provided
    if (competitorCorrections) {
      console.log('📝 Corrections concurrents détectées - ajout au prompt...');
      const competitorSection = `
═══════════════════════════════════════════════════════════════
🏢 CONCURRENTS CORRIGÉS PAR L'UTILISATEUR (Priorité absolue)
═══════════════════════════════════════════════════════════════

L'utilisateur a corrigé l'écosystème concurrentiel. Tu DOIS utiliser ces concurrents dans ton analyse:

${competitorCorrections.leader?.name ? `- LEADER (Goliath): "${competitorCorrections.leader.name}" ${competitorCorrections.leader.url ? `(${competitorCorrections.leader.url})` : ''}` : ''}
${competitorCorrections.direct_competitor?.name ? `- CONCURRENT DIRECT: "${competitorCorrections.direct_competitor.name}" ${competitorCorrections.direct_competitor.url ? `(${competitorCorrections.direct_competitor.url})` : ''}` : ''}
${competitorCorrections.challenger?.name ? `- CHALLENGER: "${competitorCorrections.challenger.name}" ${competitorCorrections.challenger.url ? `(${competitorCorrections.challenger.url})` : ''}` : ''}
${competitorCorrections.inspiration_source?.name ? `- SOURCE D'INSPIRATION: "${competitorCorrections.inspiration_source.name}" ${competitorCorrections.inspiration_source.url ? `(${competitorCorrections.inspiration_source.url})` : ''}` : ''}

IMPORTANT: 
1. Utilise EXACTEMENT ces noms et domaines dans la section "competitive_landscape"
2. Réanalyse les facteurs d'autorité et analyses pour ces nouveaux concurrents
3. Adapte les recommandations stratégiques en fonction de ces vrais concurrents
4. Met à jour les content_gaps et quick_wins selon ce paysage concurrentiel corrigé

`;
      userPrompt = competitorSection + userPrompt;
    }
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    // Track token usage
    trackTokenUsage('audit-strategique-ia', 'google/gemini-2.5-pro', aiResponse.usage, url);

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ success: false, error: 'Empty AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== ÉTAPE 3: PARSER LA RÉPONSE JSON ====================
    console.log('\n📝 ÉTAPE 3: Parsing de la réponse LLM...');
    
    let parsedAnalysis;
    try {
      let jsonContent = content;
      
      // Extract JSON from markdown code blocks
      if (content.includes('```json')) {
        jsonContent = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonContent = content.split('```')[1].split('```')[0].trim();
      }
      
      // Fix common JSON issues from AI responses
      jsonContent = jsonContent
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ');
      
      parsedAnalysis = JSON.parse(jsonContent);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      console.log('Raw content:', content.substring(0, 500));
      
      // Aggressive fallback
      try {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          let jsonContent = content.substring(firstBrace, lastBrace + 1);
          jsonContent = jsonContent
            .replace(/,(\s*[\}\]])/g, '$1')
            .replace(/[\r\n]+/g, ' ')
            .replace(/\s+/g, ' ');
          parsedAnalysis = JSON.parse(jsonContent);
          console.log('Successfully parsed with aggressive cleanup');
        } else {
          throw new Error('No JSON object found in response');
        }
      } catch (e2) {
        console.error('Fallback parsing also failed:', e2);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to parse AI analysis' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ==================== ÉTAPE 3b: SANITIZE BRAND NAME IN RESPONSE ====================
    console.log('\n🏷️ ÉTAPE 3b: Nettoyage du nom de marque dans la réponse...');
    parsedAnalysis = sanitizeBrandNameInResponse(parsedAnalysis, domainSlug, humanBrandName);

    // ==================== ÉTAPE 4: ENRICHIR AVEC LES DONNÉES BRUTES ====================
    const result = {
      success: true,
      data: {
        url,
        domain,
        scannedAt: new Date().toISOString(),
        ...parsedAnalysis,
        // Ajouter les données brutes DataForSEO pour référence
        raw_market_data: marketData,
        toolsData,
         // Ajouter les données de visibilité LLM brutes
         llm_visibility_raw: llmVisibilityData,
      }
    };

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ AUDIT STRATÉGIQUE IA PREMIUM TERMINÉ');
    console.log(`   - Mots-clés analysés: ${marketData?.top_keywords.length || 0}`);
    console.log(`   - Volume de marché: ${marketData?.total_market_volume.toLocaleString() || 'N/A'}`);
    console.log('═══════════════════════════════════════════════════════════════');

    // ==================== ÉTAPE 5: SAUVEGARDER DANS LE REGISTRE ====================
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    if (authHeader && supabaseUrl && supabaseKey) {
      saveStrategicRecommendationsToRegistry(
        supabaseUrl,
        supabaseKey,
        authHeader,
        domain,
        url,
        parsedAnalysis
      ).catch(err => console.error('Erreur sauvegarde registre stratégique:', err));
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate audit';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
