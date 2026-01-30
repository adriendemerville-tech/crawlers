const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
async function detectBusinessContext(domain: string, htmlContent?: string): Promise<{ sector: string; location: string }> {
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
  
  // Pour le secteur, on utilise le nom de domaine comme indice
  // Le LLM affinera ensuite
  const sector = domainParts[0].replace(/-/g, ' ');
  
  return { sector, location };
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
 * Génère des mots-clés seed basés sur le domaine et secteur détecté
 */
function generateSeedKeywords(domain: string, sector: string): string[] {
  const cleanDomain = domain.replace(/\.(com|fr|net|org|io|co|be|ch)$/i, '').replace(/-/g, ' ');
  
  return [
    cleanDomain,
    sector,
    `${sector} professionnel`,
    `meilleur ${sector}`,
    `${sector} en ligne`,
  ].filter(kw => kw.length > 2);
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
    console.log(`📋 Contexte détecté: secteur="${context.sector}", location="${context.location}"`);
    
    // 2. Obtenir le location_code
    const location = await getLocationCode(context.location);
    if (!location) {
      console.error('❌ Impossible de déterminer la location');
      return null;
    }
    
    // 3. Générer les mots-clés seed
    const seedKeywords = generateSeedKeywords(domain, context.sector);
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
14. Accessibilité Bots IA: Facilité de lecture pour les agents autonomes
15. Infrastructure Performance: Impact de la vitesse sur la rétention IA/Humaine
16. Cohérence Sémantique: Alignement du message Title/H1`;

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
      "name": "Nom du leader (Goliath)",
      "url": "URL du site",
      "authority_factor": "Facteur d'autorité principal",
      "analysis": "Analyse de la position dominante"
    },
    "direct_competitor": {
      "name": "Nom du concurrent direct",
      "url": "URL du site",
      "authority_factor": "Parité d'offre détectée",
      "analysis": "Analyse comparative"
    },
    "challenger": {
      "name": "Nom du challenger",
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
- L'executive_roadmap doit contenir MINIMUM 5 recommandations narratives BASÉES SUR LES DONNÉES
- Chaque prescriptive_action doit être un paragraphe complet (4-5 phrases), pas une phrase courte
- Le JSON doit être pur, sans virgules traînantes, prêt pour JSON.parse()`;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, toolsData, hallucinationCorrections } = await req.json();

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

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🚀 AUDIT STRATÉGIQUE IA PREMIUM pour:', domain);
    console.log('═══════════════════════════════════════════════════════════════');

    // ==================== ÉTAPE 1: COLLECTER LES DONNÉES DATAFORSEO ====================
    console.log('\n📊 ÉTAPE 1: Collecte des données de marché DataForSEO...');
    const marketData = await fetchMarketData(domain);
    
    if (marketData) {
      console.log(`✅ Données de marché collectées: ${marketData.top_keywords.length} mots-clés`);
    } else {
      console.log('⚠️ DataForSEO non disponible, l\'audit utilisera uniquement le LLM');
    }

    // ==================== ÉTAPE 2: GÉNÉRER L'ANALYSE LLM ====================
    console.log('\n🤖 ÉTAPE 2: Génération de l\'analyse LLM avec données enrichies...');
    
    // Build prompt with hallucination corrections as priority weights if provided
    let userPrompt = buildUserPrompt(url, domain, effectiveToolsData, marketData);
    
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
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
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
      }
    };

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ AUDIT STRATÉGIQUE IA PREMIUM TERMINÉ');
    console.log(`   - Mots-clés analysés: ${marketData?.top_keywords.length || 0}`);
    console.log(`   - Volume de marché: ${marketData?.total_market_volume.toLocaleString() || 'N/A'}`);
    console.log('═══════════════════════════════════════════════════════════════');

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
