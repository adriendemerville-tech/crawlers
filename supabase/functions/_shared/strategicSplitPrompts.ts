/**
 * Split prompts for parallel strategic audit.
 * The monolithic SYSTEM_PROMPT is divided into 3 focused calls:
 *   A: Identity (intro, brand_authority, social_signals, client_targets, executive_summary)
 *   B: Market (competitive_landscape, market_intelligence, keyword_positioning, priority_content, market_data_summary)
 *   C: GEO & Scoring (geo_citability, llm_visibility, conversational_intent, zero_click_risk, executive_roadmap, quotability, summary_resilience, lexical_footprint, expertise_sentiment, red_team)
 */

// ==================== SHARED RULES ====================

const ANTI_SELF_CITATION = `RÈGLE ABSOLUE ANTI-AUTO-CITATION: Le site analysé ne doit JAMAIS apparaître comme son propre concurrent. Ne cite JAMAIS le domaine analysé, son URL, ni son nom de marque dans les listes de concurrents. Tous les acteurs doivent être des entités DISTINCTES du site audité.`;

const INTRO_LENGTH_RULE = `RÈGLE INTRODUCTION: présentation + strengths + improvement = 1400 caractères MAX au total (espaces compris). Nombre de phrases libre, répartition libre entre les 3 champs selon la pertinence de l'URL.`;

// ==================== CALL A: IDENTITY ====================

export const SYSTEM_PROMPT_A = `RÔLE: Senior Digital Strategist spécialisé Brand Authority & GEO. Rapport premium.
POSTURE: Analytique, souverain, prescriptif. Jargon expert.

${ANTI_SELF_CITATION}
${INTRO_LENGTH_RULE}

MODULES:
- Introduction (présentation, atouts, amélioration, concurrents nommés)
- Brand Authority (ADN marque, thought leadership score, entity strength)
- Social Signals (preuve sociale sur Reddit/X/LinkedIn/YouTube/Instagram/Facebook, thought leadership E-E-A-T, sentiment & polarité)
- Cibles Clients (primary/secondary/untapped avec B2B/B2C, segment, CSP, pouvoir d'achat, fréquence d'achat, mode paiement)
- Executive Summary (3-4ph CEO/CMO)

RÈGLE CIBLES CLIENTS:
- Analyser contenu, pricing, ton, CTA et produits/services pour déduire les cibles.
- PRIMARY: 1-2 cibles (confidence > 0.7). SECONDARY: 1-2 (confidence 0.4-0.7). UNTAPPED: exactement 2 avec rationale.
- Remplir UNIQUEMENT b2b OU b2c selon le market, jamais les deux pour la même cible.`;

export function buildUserPromptA(url: string, domain: string, baseContext: string): string {
  return `${baseContext}

GÉNÈRE un JSON avec UNIQUEMENT ces clés:
{"introduction":{"presentation":"...","strengths":"...","improvement":"...","competitors":["Leader","Concurrent","Challenger"]},
"brand_authority":{"dna_analysis":"...","thought_leadership_score":0-100,"entity_strength":"dominant|established|emerging|unknown"},
"social_signals":{"proof_sources":[{"platform":"reddit|x|linkedin|youtube|instagram|facebook","presence_level":"strong|moderate|weak|absent","analysis":"max 450 car","profile_url":"URL exacte ou null","profile_name":"ou null"}],"thought_leadership":{"founder_authority":"high|moderate|low|unknown","entity_recognition":"...","eeat_score":0-10,"analysis":"Distingue signaux vérifiés vs inférés"},"sentiment":{"overall_polarity":"positive|mostly_positive|neutral|mixed|negative","hallucination_risk":"low|medium|high","reputation_vibration":"..."}},
"client_targets":{"primary":[{"market":"B2B|B2C|B2B2C","b2b":{"segment":"...","sector":"...","job_segment":"...","role":"...","buying_frequency":"...","payment_mode":"..."},"b2c":{"gender":"...","age_range":"...","csp":"...","purchasing_power":"...","buying_frequency":"...","payment_mode":"..."},"geo_scope":"...","geo_country":"...","intent":"...","maturity":"...","confidence":0.0-1.0,"evidence":"..."}],"secondary":[...],"untapped":[{"market":"...","rationale":"...","confidence":0.3-0.6,...}]},"business_model":{"model":"saas_b2b|saas_b2c|marketplace_b2b|marketplace_b2c|marketplace_b2b2c|ecommerce_b2c|ecommerce_b2b|media_publisher|service_local|service_agency|leadgen|nonprofit","confidence":0.0-1.0,"evidence":"preuve courte issue du contenu crawlé (panier, pricing, vendeurs tiers, articles…)"},
"executive_summary":"3-4ph CEO/CMO","overallScore":0-100}

RÈGLES:
- introduction: 1400 caractères MAX au total (3 champs combinés)
- profile_url: UNIQUEMENT URLs listées dans E-E-A-T ci-dessus. COPIE-COLLE. Max 2 profils avec URL. Sinon null.
- eeat_score EVIDENCE-BASED
- MALUS AUTORITÉ PROPORTIONNÉ (business digital) : 0 backlink éditorial + domaine ≥2 ans → -2pts. 0 backlink éditorial + domaine <2 ans → -1pt. 1-3 backlinks éditoriaux → -0.5pt. 4+ → pas de malus.
- PARADOXE VENDEUR: Si le site vend un service X mais n'exhibe pas les signaux de X → faille à signaler dans l'analysis.
- proof_sources: qualifier comme "verified" (URL crawlée), "inferred" (sans URL), ou "absent". NE JAMAIS inventer.
- client_targets: OBLIGATOIRE. primary 1-2, secondary 1-2, untapped exactement 2
- NE PRÉTENDS PAS connaître: nb abonnés, existence GMB, fraîcheur posts
- direct_competitor dans competitors[]: JAMAIS "${domain}"
- JSON pur, sans virgules traînantes`;
}

// ==================== CALL B: MARKET ====================

export const SYSTEM_PROMPT_B = `RÔLE: Senior SEO Strategist spécialisé en analyse concurrentielle et positionnement SERP.
POSTURE: Analytique, data-driven. Utilise les données DataForSEO réelles.

${ANTI_SELF_CITATION}

RÈGLE CLASSIFICATION DES CONCURRENTS (scoring de similarité):
- LEADER (Goliath): Premier dans la SERP. Score similarité entreprise = 1, produit = 1.
- CONCURRENT DIRECT: Même similarité, position SERP égale ou supérieure. INTERDIT: médias, annuaires, marketplaces, réseaux sociaux, Wikipedia.
- CHALLENGER: Même similarité, position INFÉRIEURE dans la SERP.
- SOURCE D'INSPIRATION: Similarité entreprise ≥0.5, produit ≥0.5, première page SERP.

RÈGLE ANTI-HOMONYMIE CONCURRENTS:
- Les concurrents DOIVENT être dans le MÊME secteur d'activité que le site analysé (indiqué dans SECTEUR D'ACTIVITÉ).
- JAMAIS de sites sur des personnalités politiques, culturelles ou médiatiques homonymes.
- Si les données DataForSEO/SERP fournissent des concurrents, UTILISE-LES EN PRIORITÉ au lieu d'halluciner des concurrents.
- Si aucun concurrent DataForSEO n'est fourni, cherche des acteurs dans le MÊME SECTEUR, PAS des résultats liés au nom de marque.

RÈGLE MOTS-CLÉS: MIN 5 obligatoires avec strategic_analysis. JAMAIS le nom de marque. 100% génériques.
Identifie Quick Wins (position 11-20, volume>100), Contenus manquants (non classé, volume>50). TOUJOURS 2-3 content_gaps.`;

export function buildUserPromptB(url: string, domain: string, baseContext: string): string {
  return `${baseContext}

GÉNÈRE un JSON avec UNIQUEMENT ces clés:
{"competitive_landscape":{"leader":{"name":"...","url":"...","authority_factor":"...","analysis":"3-4ph"},"direct_competitor":{"name":"...","url":"URL VALIDE","authority_factor":"...","analysis":"3-4ph"},"challenger":{"name":"...","url":"...","authority_factor":"...","analysis":"3-4ph"},"inspiration_source":{"name":"...","url":"...","authority_factor":"...","analysis":"3-4ph"}},
"market_intelligence":{"sophistication":{"level":1-5,"description":"...","emotional_levers":["1","2","3"]},"semantic_gap":{"current_position":0-100,"leader_position":0-100,"gap_analysis":"...","priority_themes":["t1","t2","t3","t4"],"closing_strategy":"..."}},
"keyword_positioning":{"main_keywords":[{"keyword":"...","volume":0,"difficulty":0,"current_rank":"...","strategic_analysis":{"intent":"Transactionnel|Informatif|Décisionnel|Navigationnel","business_value":"High|Medium|Low","pain_point":"...","recommended_action":"..."}}],"quick_wins":[{"keyword":"...","volume":0,"current_rank":15,"action":"..."}],"content_gaps":[{"keyword":"...","volume":100,"priority":"high|medium|low","action":"..."}],"opportunities":["..."],"competitive_gaps":["..."],"recommendations":["..."],"missing_terms":[{"term":"...","importance":"critical|important|optional","competitor_usage":"...","suggested_placement":"..."}],"semantic_density":{"score":0-100,"verdict":"optimal|acceptable|thin|critical","analysis":"...","vs_competitors":"...","top_missing_clusters":["1","2"]},"serp_recommendations":[{"action":"...","expected_impact":"high|medium|low","difficulty":"easy|medium|hard","timeframe":"..."}],"alternative_strategy":null},
"priority_content":{"missing_pages":[{"title":"...","rationale":"...","target_keywords":[],"expected_impact":"high|medium|low"}],"content_upgrades":[{"page":"...","current_issue":"...","upgrade_strategy":"..."}]},
"market_data_summary":{"total_market_volume":0,"keywords_ranked":0,"keywords_analyzed":0,"average_position":0,"data_source":"dataforseo|fallback"}}

RÈGLES:
- main_keywords: MIN 5. Complète si <5 résultats DataForSEO.
- direct_competitor: JAMAIS "${domain}". AUTRE domaine, même core business.
- missing_terms: MIN 3 termes clés absents du site.
- semantic_density: comparer vs top 3 SERP.
- serp_recommendations: MIN 3 actions concrètes.
- alternative_strategy: UNIQUEMENT si position >50. Sinon null.
- JSON pur, sans virgules traînantes`;
}

// ==================== CALL C: GEO & SCORING ====================

export const SYSTEM_PROMPT_C = `RÔLE: Senior GEO Strategist spécialisé en visibilité IA et optimisation pour les moteurs de réponse.
POSTURE: Analytique, prescriptif. Recommandations NARRATIVES: chaque action = paragraphe rédigé 4-5 phrases.

Modules: GEO Citabilité, Visibilité LLM, Intent conversationnel, Risque Zéro-Clic, Roadmap exécutive, Quotabilité, Résilience au résumé, Empreinte lexicale, Sentiment d'expertise, Red Team.`;

export function buildUserPromptC(url: string, domain: string, baseContext: string, factualCitationContext?: string): string {
  const citationInjection = factualCitationContext
    ? `\n${factualCitationContext}\n`
    : '';

  return `${baseContext}
${citationInjection}
GÉNÈRE un JSON avec UNIQUEMENT ces clés:
{"geo_citability":{"score":0-100,"readiness_level":"pioneer|ready|developing|basic|absent","analysis":"...","strengths":[],"weaknesses":[],"recommendations":[]},
"llm_visibility":{"citation_probability":0-100,"citation_breakdown":{"serp_presence":0-100,"structured_data_quality":0-100,"content_quotability":0-100,"brand_authority":0-100,"content_freshness":0-100,"business_intent_match":0-100,"self_citation_signals":0-100,"knowledge_graph_signals":0-100},"knowledge_graph_presence":"strong|moderate|weak|absent","analysis":"...","test_queries":[{"query":"...","purpose":"...","target_llms":["ChatGPT","Claude","Perplexity"]}]},
"conversational_intent":{"ratio":0-100,"analysis":"...","question_titles_detected":0,"total_titles_analyzed":0,"examples":["3-5 questions naturelles"],"recommendations":[]},
"zero_click_risk":{"at_risk_keywords":[{"keyword":"...","volume":0,"risk_level":"high|medium|low","sge_threat":"...","defense_strategy":"..."}],"overall_risk_score":0-100,"analysis":"..."},
"executive_roadmap":[{"title":"...","prescriptive_action":"4-5ph","strategic_rationale":"...","expected_roi":"High|Medium|Low","category":"Identité|Contenu|Autorité|Social|Technique","priority":"Prioritaire|Important|Opportunité"}],
"quotability":{"score":0-100,"quotes":["phrase citable 1","2","3"]},
"summary_resilience":{"score":0-100,"originalH1":"...","llmSummary":"10 mots max"},
"lexical_footprint":{"jargonRatio":0-100,"concreteRatio":0-100},
"expertise_sentiment":{"rating":1-5,"justification":"1ph","social_proof":{"has_testimonials":true/false,"has_reviews":true/false,"has_portfolio_links":true/false,"details":"1ph"}},
"red_team":{"flaws":["faille 1","preuve manquante 2","objection 3"]}}

RÈGLES:
- citation_probability: moyenne pondérée de citation_breakdown (serp_presence×20%, structured_data_quality×10%, content_quotability×15%, brand_authority×15%, content_freshness×5%, business_intent_match×15%, self_citation_signals×10%, knowledge_graph_signals×10%). Si des valeurs pré-calculées sont fournies ci-dessus, RECOPIE-LES telles quelles. N'évalue QUE les signaux marqués null. business_intent_match: alignement entre contenu et intention commerciale réelle du secteur. self_citation_signals: présence de formulations "Chez [marque]..." dans le texte.
- executive_roadmap: MIN 6 recs narratives dont ≥1 category "Social"
- quotability: phrases factuelles autonomes citables. +33pts/citation.
- summary_resilience: résumé ≤10 mots.
- lexical_footprint: jargonRatio+concreteRatio=100. "jargon" = UNIQUEMENT formules vides/corporate.
- expertise_sentiment: 1(générique/IA) à 5(expert terrain). social_proof: vérifie la présence de témoignages/études de cas (has_testimonials), d'avis clients (has_reviews), de liens vers des réalisations concrètes/portfolio (has_portfolio_links). details = résumé de ce qui a été trouvé ou manque.
- red_team: 3 failles/objections client sceptique.
- JSON pur, sans virgules traînantes`;
}

// ==================== MERGE RESULTS ====================

export function mergeParallelResults(resultA: any, resultB: any, resultC: any): any {
  return {
    // From A: Identity
    introduction: resultA?.introduction || { presentation: '', strengths: '', improvement: '', competitors: [] },
    brand_authority: resultA?.brand_authority || { dna_analysis: '', thought_leadership_score: 0, entity_strength: 'unknown' },
    social_signals: resultA?.social_signals || { proof_sources: [], thought_leadership: { founder_authority: 'unknown', entity_recognition: '', eeat_score: 0, analysis: '' }, sentiment: { overall_polarity: 'neutral', hallucination_risk: 'medium', reputation_vibration: '' } },
    client_targets: resultA?.client_targets || { primary: [], secondary: [], untapped: [] },
    executive_summary: resultA?.executive_summary || '',
    overallScore: resultA?.overallScore ?? 0,

    // From B: Market
    competitive_landscape: resultB?.competitive_landscape || { leader: { name: 'Non identifié' }, direct_competitor: { name: 'Non identifié' }, challenger: { name: 'Non identifié' }, inspiration_source: { name: 'Non identifié' } },
    market_intelligence: resultB?.market_intelligence || { sophistication: { level: 1, description: '', emotional_levers: [] }, semantic_gap: { current_position: 0, leader_position: 0, gap_analysis: '', priority_themes: [], closing_strategy: '' } },
    keyword_positioning: resultB?.keyword_positioning || null,
    priority_content: resultB?.priority_content || { missing_pages: [], content_upgrades: [] },
    market_data_summary: resultB?.market_data_summary || null,

    // From C: GEO & Scoring
    geo_citability: resultC?.geo_citability || { score: 0, readiness_level: 'basic', analysis: '', strengths: [], weaknesses: [], recommendations: [] },
    llm_visibility: resultC?.llm_visibility || { citation_probability: 0, citation_breakdown: { serp_presence: 0, structured_data_quality: 0, content_quotability: 0, brand_authority: 0, content_freshness: 0, business_intent_match: 0, self_citation_signals: 0, knowledge_graph_signals: 0 }, knowledge_graph_presence: 'absent', analysis: '', test_queries: [] },
    conversational_intent: resultC?.conversational_intent || { ratio: 0, analysis: '', question_titles_detected: 0, total_titles_analyzed: 0, examples: [], recommendations: [] },
    zero_click_risk: resultC?.zero_click_risk || { at_risk_keywords: [], overall_risk_score: 0, analysis: '' },
    executive_roadmap: resultC?.executive_roadmap || [],
    quotability: resultC?.quotability || { score: 0, quotes: [] },
    summary_resilience: resultC?.summary_resilience || { score: 0, originalH1: '', llmSummary: '' },
    lexical_footprint: resultC?.lexical_footprint || { jargonRatio: 50, concreteRatio: 50 },
    expertise_sentiment: resultC?.expertise_sentiment || { rating: 1, justification: 'Non évalué' },
    red_team: resultC?.red_team || { flaws: [] },
  };
}

/** Parse JSON from LLM response (handles markdown fences, trailing commas) */
export function parseLLMJson(raw: string): any | null {
  if (!raw) return null;
  try {
    let jsonContent = raw;
    if (raw.includes('```json')) jsonContent = raw.split('```json')[1].split('```')[0].trim();
    else if (raw.includes('```')) jsonContent = raw.split('```')[1].split('```')[0].trim();
    jsonContent = jsonContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    return JSON.parse(jsonContent);
  } catch {
    try {
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        let jsonContent = raw.substring(firstBrace, lastBrace + 1);
        jsonContent = jsonContent.replace(/,(\s*[\}\]])/g, '$1');
        return JSON.parse(jsonContent);
      }
    } catch {}
  }
  return null;
}
