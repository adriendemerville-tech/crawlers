/**
 * LLM system prompts, user prompt builder, and tools data formatter.
 */
import type { ToolsData, EEATSignals, MarketData, RankingOverview, FounderInfo, FacebookPageInfo, PageType } from './types.ts';

// ==================== TOOLS DATA → MARKDOWN ====================

export function formatToolsDataToMarkdown(toolsData: ToolsData): string {
  const lines: string[] = [];
  if (toolsData.crawlers) {
    const c = toolsData.crawlers;
    lines.push('## CRAWLERS');
    if (c.overallScore != null) lines.push(`Score: ${c.overallScore}/100`);
    if (c.bots && Array.isArray(c.bots)) { for (const b of c.bots) { if (b.name) lines.push(`- ${b.name}: ${b.isAllowed ? '✅' : '❌'}${b.crawlDelay ? ` delay=${b.crawlDelay}` : ''}`); } }
    if (c.recommendations && Array.isArray(c.recommendations)) lines.push(`Recs: ${c.recommendations.slice(0, 5).join('; ')}`);
  }
  if (toolsData.geo) {
    const g = toolsData.geo;
    lines.push('## GEO');
    if (g.overallScore != null) lines.push(`Score: ${g.overallScore}/100`);
    if (g.factors && Array.isArray(g.factors)) { for (const f of g.factors) { if (f.name) lines.push(`- ${f.name}: ${f.score ?? f.status ?? '?'}${f.details ? ` (${String(f.details).substring(0, 80)})` : ''}`); } }
    if (g.recommendations && Array.isArray(g.recommendations)) lines.push(`Recs: ${g.recommendations.slice(0, 5).join('; ')}`);
  }
  if (toolsData.llm) {
    const l = toolsData.llm;
    lines.push('## LLM');
    if (l.overallScore != null) lines.push(`Score: ${l.overallScore}/100`);
    if (l.brandMentioned != null) lines.push(`Brand mentioned: ${l.brandMentioned}`);
    if (l.citationScore != null) lines.push(`Citation: ${l.citationScore}`);
    if (l.sentimentScore != null) lines.push(`Sentiment: ${l.sentimentScore}`);
    if (l.hallucinationRisk != null) lines.push(`Hallucination risk: ${l.hallucinationRisk}`);
    if (l.models && Array.isArray(l.models)) { for (const m of l.models) { if (m.name) lines.push(`- ${m.name}: mentioned=${m.brandMentioned ?? '?'}, sentiment=${m.sentiment ?? '?'}`); } }
    if (l.recommendations && Array.isArray(l.recommendations)) lines.push(`Recs: ${l.recommendations.slice(0, 5).join('; ')}`);
  }
  if (toolsData.pagespeed) {
    const p = toolsData.pagespeed;
    lines.push('## PAGESPEED');
    if (p.overallScore != null) lines.push(`Score: ${p.overallScore}/100`);
    if (p.lcp != null) lines.push(`LCP: ${p.lcp}ms`);
    if (p.fcp != null) lines.push(`FCP: ${p.fcp}ms`);
    if (p.cls != null) lines.push(`CLS: ${p.cls}`);
    if (p.tbt != null) lines.push(`TBT: ${p.tbt}ms`);
    if (p.si != null) lines.push(`SI: ${p.si}ms`);
    if (p.ttfb != null) lines.push(`TTFB: ${p.ttfb}ms`);
    if (p.performance != null) lines.push(`Performance: ${p.performance}`);
    if (p.accessibility != null) lines.push(`Accessibility: ${p.accessibility}`);
    if (p.seo != null) lines.push(`SEO: ${p.seo}`);
    if (p.bestPractices != null) lines.push(`Best Practices: ${p.bestPractices}`);
    if (p.recommendations && Array.isArray(p.recommendations)) lines.push(`Recs: ${p.recommendations.slice(0, 5).join('; ')}`);
  }
  return lines.join('\n');
}

// ==================== SYSTEM PROMPTS ====================

export const SYSTEM_PROMPT = `RÔLE: Senior Digital Strategist spécialisé Brand Authority & GEO. Rapport premium niveau cabinet de conseil.

POSTURE: Analytique, souverain, prescriptif. Jargon expert (Entité sémantique, Topical Authority, E-E-A-T, Gap de citabilité). Recommandations NARRATIVES: chaque action = paragraphe rédigé 4-5 phrases.

RÈGLE ABSOLUE ANTI-AUTO-CITATION: Le site analysé ne doit JAMAIS apparaître comme son propre concurrent (leader, direct_competitor, challenger, inspiration_source). Ne cite JAMAIS le domaine analysé, son URL, ni son nom de marque dans competitive_landscape ni dans introduction.competitors[]. Tous les acteurs doivent être des entités DISTINCTES du site audité. Le direct_competitor ne peut PAS avoir la même URL ni le même nom que le site cible.

RÈGLE CLASSIFICATION DES CONCURRENTS (scoring de similarité):
- LEADER (Goliath): Premier dans la SERP. Score similarité entreprise = 1, Score similarité produit = 1. C'est l'acteur dominant incontesté du marché.
- CONCURRENT DIRECT: Même score similarité entreprise (1) et produit (1) que le leader, MAIS position SERP égale ou supérieure à l'URL cible. C'est un vrai rival sur le même créneau, dans la même zone géographique. INTERDIT: médias, annuaires, marketplaces, réseaux sociaux, Wikipedia.
- CHALLENGER: Même score similarité entreprise (1) et produit (1), MAIS position INFÉRIEURE dans la SERP par rapport à l'URL cible. C'est un acteur montant ou plus petit qui progresse.
- SOURCE D'INSPIRATION: Score similarité entreprise minimum 0.5, score similarité produit minimum 0.5, ET présent en première page de sa SERP. C'est un acteur innovant reconnu dans un écosystème proche. INTERDIT: médias, annuaires, marketplaces, réseaux sociaux, Wikipedia, plateformes généralistes.

Si le LLM n'est PAS sûr de son identification d'un concurrent, il DOIT indiquer dans le champ authority_factor les scores de similarité : "Sim. entreprise: X, Sim. produit: Y, SERP: #Z".

RÈGLE MOTS-CLÉS STRATÉGIQUES: La liste de mots-clés DOIT OBLIGATOIREMENT contenir au moins une requête directement liée au core business du site. Ex: pour un agent IA → "agent IA", "agent IA entreprise", "automatisation IA TPE" ; pour un plombier → "plombier Paris", "dépannage plomberie". Si aucun mot-clé core business n'apparaît dans les données DataForSEO, AJOUTE-LE manuellement avec volume estimé et rank "non classé".

DONNÉES DE MARCHÉ RÉELLES (DataForSEO): Utilise les volumes, difficultés et positions RÉELS. Identifie Quick Wins (position 11-20, volume>100), Contenus manquants (mots-clés pertinents où le site n'est PAS classé, volume>50). IMPORTANT: Tu DOIS TOUJOURS générer au moins 2-3 content_gaps en analysant les thématiques du secteur où le site n'a pas de contenu, même si les données DataForSEO ne montrent pas ces mots-clés explicitement. Déduis-les du secteur d'activité et des concurrents.

13 MODULES D'ANALYSE:
A. ÉCOSYSTÈME: 1.Market Leader 2.Concurrent Direct 3.Challenger 4.Source d'Inspiration
B. AUTORITÉ SOCIALE: 5.Preuve Sociale (Reddit,X,LinkedIn) 6.Thought Leadership E-E-A-T 7.Sentiment & Polarité
C. EXPERTISE: 8.Score GEO Citabilité 9.Matrice Gap Sémantique 10.Psychologie Conversion
D. MOTS CLÉS: 11.5 Principaux avec volumes réels 12.Opportunités 13.Gaps Concurrentiels
E. TECHNIQUE: 14.Accessibilité Bots IA 15.Performance 16.Cohérence Sémantique
F. FRAÎCHEUR & IA: 17.Fraîcheur contenus 18.Complexité Schema.org 19.Formats IA-Ready 20.First-Party Data 21.Changelog Marque
G. E-E-A-T: 22.Signaux E-E-A-T 23.Densité données 24.Knowledge Graph 25.Études de cas
H. MONITORING: 26.Monitoring LLM (GA4 referrers IA) 27.Fichier llms.txt
I. CIBLES CLIENTS: 28.Cibles principales (B2B/B2C, segment, CSP, pouvoir d'achat, fréquence d'achat, mode paiement) 29.Cibles secondaires 30.Cibles potentielles non adressées

RÈGLE CIBLES CLIENTS:
- Analyser le contenu, le pricing, le ton, les CTA et les produits/services pour déduire les cibles.
- Pour B2B: qualifier taille, secteur d'activité, segment métier (marketing, SEO, IT, etc.), rôle décisionnel, fréquence d'achat et mode de paiement.
- Pour B2C: qualifier genre, tranche d'âge, CSP, pouvoir d'achat, fréquence d'achat et mode de paiement.
- PRIMARY: 1-2 cibles les plus évidentes (confidence > 0.7). SECONDARY: 1-2 cibles secondaires (confidence 0.4-0.7). UNTAPPED: exactement 2 cibles potentielles non adressées avec rationale.
- Remplir UNIQUEMENT b2b OU b2c selon le market, jamais les deux pour la même cible.
- La zone géographique (geo_scope) et le pays sont transversaux B2B/B2C.`;

export const EDITORIAL_MODE_SYSTEM_PROMPT = `RÔLE: Senior Content SEO Strategist spécialisé en optimisation d'articles pour les moteurs de réponse IA (GEO). Rapport premium niveau cabinet de conseil.

POSTURE: Analytique, prescriptif, centré sur la PAGE (pas l'entreprise). Tu analyses un CONTENU SPÉCIFIQUE (article de blog, page éditoriale), pas un site complet.

MODE ÉDITORIAL: Cette URL est une page de contenu (/blog, /article). L'analyse porte sur la QUALITÉ et l'OPTIMISATION de cette page spécifique.

RÈGLE INTRODUCTION: L'introduction doit être COURTE (2-3 phrases max) et décrire le CONTENU de la page, pas l'entreprise. Le lien renvoie vers la page analysée.

RÈGLE CONCURRENCE SERP: Les 4 acteurs concurrents sont les PAGES (pas les entreprises) qui se positionnent dans les SERPs sur la même thématique. Chaque URL doit pointer vers la PAGE concurrente spécifique, pas vers la homepage.
- Leader: La page #1 des SERPs pour la thématique de l'article
- Concurrent Direct: Une page similaire qui se positionne juste autour
- Challenger: Une page montante ou récente sur le même sujet
- Source d'Inspiration: Une page exemplaire dans le traitement éditorial du sujet

MODULES À ANALYSER (contenu uniquement):
1. E-E-A-T de la page (auteur, citations, données)
2. Cohérence sémantique (titre/H1/contenu)
3. Score AEO (formats IA-friendly, tables, FAQ, listes)
4. Visibilité LLM (citabilité par les IA)
5. Risque Zéro-Clic
6. Indice de Citabilité (phrases autonomes citables)
7. Résilience au Résumé
8. Empreinte Lexicale
9. Sentiment d'Expertise
10. Red Team (failles du contenu)

NE PAS ANALYSER: Intelligence de marché, réseaux sociaux de l'entreprise, psychologie de conversion, positionnement de marque.`;

export const PRODUCT_MODE_SYSTEM_PROMPT = `RÔLE: Senior Product Page Strategist spécialisé en optimisation de pages produit/service pour les moteurs de recherche classiques ET les moteurs de réponse IA (GEO). Rapport premium niveau cabinet de conseil.

POSTURE: Analytique, prescriptif, centré sur la PAGE PRODUIT (pas l'entreprise entière). Tu analyses une page de conversion spécifique.

MODE PRODUIT: Cette URL est une page produit, service ou offre commerciale. L'analyse porte sur la QUALITÉ, la CONVERSION et l'OPTIMISATION GEO de cette page.

RÈGLE INTRODUCTION: L'introduction doit être COURTE (2-3 phrases max) et décrire le PRODUIT/SERVICE présenté sur la page, pas l'entreprise dans son ensemble. Le lien renvoie vers la page analysée.

RÈGLE CONCURRENCE SERP: Les 4 acteurs concurrents sont les PAGES PRODUIT/SERVICE concurrentes dans les SERPs pour la même requête d'achat. Chaque URL doit pointer vers la page produit concurrente.
- Leader: La page produit #1 des SERPs pour cette catégorie
- Concurrent Direct: Un produit/service similaire qui se positionne juste autour  
- Challenger: Une page produit montante ou disruptive
- Source d'Inspiration: Une page produit exemplaire en matière de conversion ET de SEO

MODULES À ANALYSER:
1. Schema Product/Service (données structurées e-commerce)
2. Cohérence sémantique (titre/H1/contenu produit)
3. Score AEO (formats IA-friendly: tableaux comparatifs, FAQ, specs)
4. Visibilité LLM (le produit est-il recommandé par les IA?)
5. Risque Zéro-Clic (les IA donnent-elles déjà la réponse?)
6. Indice de Citabilité (le produit est-il citable de manière autonome?)
7. Résilience au Résumé
8. Empreinte Lexicale (vocabulaire commercial vs technique)
9. Positionnement de mots-clés (termes d'achat, comparatifs)
10. Red Team (failles de la page produit)

ANALYSER AUSSI: Intelligence de marché LIMITÉE au segment produit, positionnement prix si détectable.
NE PAS ANALYSER: Réseaux sociaux de l'entreprise, thought leadership du fondateur.`;

export const DEEP_PAGE_SYSTEM_PROMPT = `RÔLE: Senior SEO & GEO Strategist spécialisé en optimisation de pages internes profondes. Rapport premium niveau cabinet de conseil.

POSTURE: Analytique, prescriptif, centré sur CETTE PAGE SPÉCIFIQUE (pas l'entreprise). Tu analyses une page interne profonde qui a un objectif précis.

MODE PAGE PROFONDE: Cette URL est une page interne spécifique (sous-page, landing page, page catégorie). L'analyse porte sur la pertinence et l'optimisation de cette page dans son contexte.

RÈGLE INTRODUCTION: L'introduction doit être COURTE (2-3 phrases max) et identifier le TYPE et l'OBJECTIF de cette page spécifique. Le lien renvoie vers la page analysée.

RÈGLE CONCURRENCE SERP: Les 4 acteurs concurrents sont les PAGES similaires dans les SERPs qui ciblent la même intention de recherche. Chaque URL doit pointer vers la page concurrente spécifique.
- Leader: La page #1 des SERPs pour l'intention de cette page
- Concurrent Direct: Une page similaire avec le même objectif
- Challenger: Une page innovante sur le même sujet
- Source d'Inspiration: Une page exemplaire dans son approche

MODULES À ANALYSER:
1. E-E-A-T de la page
2. Cohérence sémantique (titre/H1/contenu)
3. Score AEO (formats IA-friendly)
4. Visibilité LLM
5. Risque Zéro-Clic
6. Indice de Citabilité
7. Résilience au Résumé
8. Empreinte Lexicale
9. Positionnement de mots-clés
10. Red Team

ANALYSER AUSSI: Intelligence de marché LIMITÉE au sujet de la page.
NE PAS ANALYSER: Réseaux sociaux de l'entreprise, thought leadership du fondateur.`;

export function getSystemPromptForPageType(pageType: PageType): string {
  switch (pageType) {
    case 'editorial': return EDITORIAL_MODE_SYSTEM_PROMPT;
    case 'product': return PRODUCT_MODE_SYSTEM_PROMPT;
    case 'deep': return DEEP_PAGE_SYSTEM_PROMPT;
    default: return SYSTEM_PROMPT;
  }
}

// ==================== USER PROMPT BUILDER ====================

export function buildUserPrompt(
  url: string, domain: string, toolsData: ToolsData, marketData: MarketData | null,
  pageContentContext: string = '', eeatSignals?: EEATSignals, founderInfo?: FounderInfo,
  rankingOverview?: RankingOverview | null, contentMode: boolean = false, facebookPageInfo?: FacebookPageInfo
): string {
  let marketSection = '';
  if (marketData) {
    const kwList = marketData.top_keywords.map(kw => `"${kw.keyword}":${kw.volume}vol,diff${kw.difficulty},pos:${kw.current_rank}`).join('; ');
    const quickWins = marketData.top_keywords.filter(kw => typeof kw.current_rank === 'number' && kw.current_rank >= 11 && kw.current_rank <= 20 && kw.volume > 100);
    const missing = marketData.top_keywords.filter(kw => !kw.is_ranked && kw.volume > 200);
    marketSection = `📊 DONNÉES MARCHÉ (DataForSEO) - Zone: ${marketData.location_used}, Volume total: ${marketData.total_market_volume}\nMots-clés: ${kwList}\nQuick Wins: ${quickWins.length > 0 ? quickWins.map(kw => `"${kw.keyword}" pos${kw.current_rank}(${kw.volume}vol)`).join(', ') : 'Aucun'}\nManquants: ${missing.length > 0 ? missing.map(kw => `"${kw.keyword}"(${kw.volume}vol)`).join(', ') : 'Aucun'}`;
  } else {
    marketSection = `⚠️ DataForSEO non disponible - base-toi sur ton analyse du secteur.`;
  }

  if (rankingOverview) {
    marketSection += `\n📈 ÉTAT DES LIEUX SEO: ${rankingOverview.total_ranked_keywords} mots-clés positionnés, pos moy=${rankingOverview.average_position_global}, Top10 moy=${rankingOverview.average_position_top10 || 'N/A'}, ETV=${rankingOverview.etv}\nDistrib: Top3=${rankingOverview.distribution.top3} Top10=${rankingOverview.distribution.top10} Top20=${rankingOverview.distribution.top20} Top50=${rankingOverview.distribution.top50} Top100=${rankingOverview.distribution.top100}\nTop positionnés: ${rankingOverview.top_keywords.slice(0, 5).map(k => `"${k.keyword}" pos${k.position}(${k.volume}vol)`).join(', ')}`;
  }

  let eeatSection = '';
  if (eeatSignals) {
    const yn = (v: boolean) => v ? 'OUI' : 'NON';
    const lines = [`🔍 E-E-A-T: AuthorBio=${yn(eeatSignals.hasAuthorBio)}(${eeatSignals.authorBioCount}), AuthorJsonLD=${yn(eeatSignals.hasAuthorInJsonLd)}, Person=${yn(eeatSignals.hasPerson)}, ProfilePage=${yn(eeatSignals.hasProfilePage)}, Organization=${yn(eeatSignals.hasOrganization)}, sameAs=${yn(eeatSignals.hasSameAs)}, Wikidata=${yn(eeatSignals.hasWikidataSameAs)}, SocialLinks=${eeatSignals.socialLinksCount}, ExpertCitations=${yn(eeatSignals.hasExpertCitations)}, CaseStudies=${yn(eeatSignals.hasCaseStudies)}(${eeatSignals.caseStudySignals})`];
    if (eeatSignals.detectedSocialUrls.length > 0) {
      lines.push(`URLs sociales: ${eeatSignals.detectedSocialUrls.slice(0, 10).join(', ')}`);
      const personalLI = eeatSignals.linkedInUrls.filter(u => /linkedin\.com\/in\//i.test(u));
      const companyLI = eeatSignals.linkedInUrls.filter(u => /linkedin\.com\/company\//i.test(u));
      if (personalLI.length > 0) lines.push(`LinkedIn perso: ${personalLI.join(', ')}`);
      if (companyLI.length > 0) lines.push(`LinkedIn entreprise: ${companyLI.join(', ')}`);
    }
    if (facebookPageInfo?.found && facebookPageInfo.pageUrl) lines.push(`📘 Facebook Page SERP: ${facebookPageInfo.pageName || 'trouvée'} → ${facebookPageInfo.pageUrl}`);
    else lines.push(`📘 Facebook Page SERP: NON TROUVÉE`);
    eeatSection = lines.join('\n');
  }

  let founderSection = '';
  if (!contentMode) {
    if (founderInfo?.name && !founderInfo.geoMismatch) {
      founderSection = `\n👤 FONDATEUR: ${founderInfo.name} (${founderInfo.platform || '?'})${founderInfo.profileUrl ? ` URL:${founderInfo.profileUrl}` : ''} Social:${founderInfo.isInfluencer ? 'actif' : 'non'}. Cite ce nom dans thought_leadership.analysis.`;
    } else if (founderInfo?.geoMismatch) {
      founderSection = `\n⚠️ Fondateur homonyme étranger (${founderInfo.detectedCountry}) — NE PAS mentionner. founder_authority="unknown".`;
    }
  }

  const toolsMarkdown = formatToolsDataToMarkdown(toolsData);

  if (contentMode) {
    return `Analyse cette PAGE DE CONTENU: "${url}" (${domain}).
${pageContentContext}
${eeatSection}
${marketSection}
${toolsMarkdown}

⚠️ MODE CONTENU: Analyse la PAGE elle-même, pas l'entreprise. La présentation doit décrire le contenu de la page en 2-3 phrases courtes.

CONCURRENCE SERP: Les concurrents sont les PAGES qui se positionnent dans les SERPs sur la même thématique que cet article. Chaque URL doit pointer vers la PAGE concurrente, pas la homepage.

GÉNÈRE un JSON:
{"introduction":{"presentation":"1-2ph courtes analysant LE CONTENU de la page","strengths":"1-2ph sur les forces du contenu","improvement":"1-2ph sur les axes d'amélioration du contenu","competitors":["Page Leader SERP","Page Concurrente","Page Challenger"]},
"brand_authority":{"dna_analysis":"Analyse de l'expertise démontrée dans le contenu","thought_leadership_score":0-100,"entity_strength":"dominant|established|emerging|unknown"},
"competitive_landscape":{"leader":{"name":"Titre de la page #1 SERP","url":"URL de la page","authority_factor":"Pourquoi cette page domine","analysis":"2-3ph"},"direct_competitor":{"name":"Titre page concurrente","url":"URL de la page","authority_factor":"...","analysis":"2-3ph"},"challenger":{"name":"Titre page challenger","url":"URL","authority_factor":"...","analysis":"2-3ph"},"inspiration_source":{"name":"Titre page exemplaire","url":"URL","authority_factor":"...","analysis":"2-3ph"}},
"geo_citability":{"score":0-100,"readiness_level":"pioneer|ready|developing|basic|absent","analysis":"...","strengths":[],"weaknesses":[],"recommendations":[]},
"llm_visibility":{"citation_probability":0-100,"citation_breakdown":{"serp_presence":0-100,"structured_data_quality":0-100,"content_quotability":0-100,"brand_authority":0-100,"content_freshness":0-100,"business_intent_match":0-100,"self_citation_signals":0-100,"knowledge_graph_signals":0-100},"knowledge_graph_presence":"strong|moderate|weak|absent","analysis":"...","test_queries":[{"query":"...","purpose":"...","target_llms":["ChatGPT","Claude","Perplexity"]}]},
"conversational_intent":{"ratio":0-100,"analysis":"...","question_titles_detected":0,"total_titles_analyzed":0,"examples":["3-5 questions naturelles liées au contenu"],"recommendations":[]},
"zero_click_risk":{"at_risk_keywords":[{"keyword":"...","volume":0,"risk_level":"high|medium|low","sge_threat":"...","defense_strategy":"..."}],"overall_risk_score":0-100,"analysis":"..."},
"keyword_positioning":{"main_keywords":[{"keyword":"...","volume":0,"difficulty":0,"current_rank":"...","strategic_analysis":{"intent":"...","business_value":"High|Medium|Low","pain_point":"...","recommended_action":"..."}}],"quick_wins":[],"content_gaps":[],"opportunities":[],"competitive_gaps":[],"recommendations":[],"missing_terms":[{"term":"terme clé absent","importance":"critical|important|optional","competitor_usage":"Utilisé par 3/4 concurrents en H2 et corps de texte","suggested_placement":"Intégrer dans le H2 et le premier paragraphe"}],"semantic_density":{"score":0-100,"verdict":"optimal|acceptable|thin|critical","analysis":"...","vs_competitors":"Comparaison densité sémantique vs top 3 SERP","top_missing_clusters":["cluster thématique manquant 1","2"]},"serp_recommendations":[{"action":"Action concrète pour remonter","expected_impact":"high|medium|low","difficulty":"easy|medium|hard","timeframe":"2-4 semaines"}],"alternative_strategy":null},
"market_data_summary":{"total_market_volume":0,"keywords_ranked":0,"keywords_analyzed":0,"average_position":0,"data_source":"dataforseo|fallback"},
"executive_roadmap":[{"title":"...","prescriptive_action":"4-5ph","strategic_rationale":"...","expected_roi":"High|Medium|Low","category":"Contenu|Autorité|Technique","priority":"Prioritaire|Important|Opportunité"}],
"client_targets":{"primary":[{"market":"B2B|B2C","b2b":{"segment":"...","sector":"...","job_segment":"...","role":"...","buying_frequency":"...","payment_mode":"..."},"b2c":{"gender":"...","age_range":"...","csp":"...","purchasing_power":"...","buying_frequency":"...","payment_mode":"..."},"geo_scope":"...","intent":"...","maturity":"...","confidence":0.0-1.0,"evidence":"..."}],"secondary":[...],"untapped":[{"market":"...","rationale":"...","confidence":0.3-0.6,...}]},"business_model":{"model":"saas_b2b|saas_b2c|marketplace_b2b|marketplace_b2c|marketplace_b2b2c|ecommerce_b2c|ecommerce_b2b|media_publisher|service_local|service_agency|leadgen|nonprofit","confidence":0.0-1.0,"evidence":"preuve courte issue du contenu crawlé (panier, pricing, vendeurs tiers, articles…)"},
"executive_summary":"2-3ph résumé du potentiel de cette page","overallScore":0-100,
"quotability":{"score":0-100,"quotes":["phrase citable 1","2","3"]},
"summary_resilience":{"score":0-100,"originalH1":"...","llmSummary":"10 mots max"},
"lexical_footprint":{"jargonRatio":0-100,"concreteRatio":0-100},
"expertise_sentiment":{"rating":1-5,"justification":"1ph"},
"red_team":{"flaws":["faille contenu 1","preuve manquante 2","objection lecteur 3"]}}

RÈGLES:
- introduction.presentation: 1-2 phrases COURTES décrivant LE CONTENU de cette page, pas l'entreprise
- competitive_landscape: 4 PAGES concurrentes dans les SERPs, pas des entreprises. URLs = pages spécifiques
- NE génère PAS: social_signals, market_intelligence, priority_content
- executive_roadmap: MIN 4 recs centrées sur l'optimisation du CONTENU
- quotability, summary_resilience, lexical_footprint, expertise_sentiment, red_team: obligatoires
- missing_terms: MIN 3 termes clés que les concurrents SERP utilisent mais que cette page n'utilise pas. Analyse le contenu réel.
- semantic_density: compare la richesse sémantique de la page vs les 3 premiers concurrents SERP. Score objectif.
- serp_recommendations: MIN 3 actions concrètes et actionnables pour améliorer le positionnement SERP.
- alternative_strategy: UNIQUEMENT si le site est en position très défavorable (position >50, domaine faible autorité, peu de leviers SEO). Sinon null. Si présent: répondre à quoi/comment/combien. Rappeler qu'une action offsite a TOUJOURS des répercussions positives sur le ranking. Types: RP presse, partenariat avec entreprise complémentaire (nommer qui), stratégie vidéo réseaux sociaux, événement.
- JSON pur, sans virgules traînantes`;
  }

  return `Analyse "${url}" (${domain}).
${pageContentContext}
${eeatSection}${founderSection}
${marketSection}
${toolsMarkdown}

GÉNÈRE un JSON:
{"introduction":{"presentation":"2ph max","strengths":"2ph max","improvement":"2ph max","competitors":["Leader","Concurrent","Challenger"]},
"brand_authority":{"dna_analysis":"...","thought_leadership_score":0-100,"entity_strength":"dominant|established|emerging|unknown"},
"social_signals":{"proof_sources":[{"platform":"reddit|x|linkedin|youtube|instagram|facebook","presence_level":"strong|moderate|weak|absent","analysis":"max 450 car","profile_url":"URL exacte des E-E-A-T ou null","profile_name":"ou null"}],"thought_leadership":{"founder_authority":"high|moderate|low|unknown","entity_recognition":"...","eeat_score":0-10,"analysis":"Distingue signaux vérifiés vs inférés"},"sentiment":{"overall_polarity":"positive|mostly_positive|neutral|mixed|negative","hallucination_risk":"low|medium|high","reputation_vibration":"..."}},
"market_intelligence":{"sophistication":{"level":1-5,"description":"...","emotional_levers":["1","2","3"]},"semantic_gap":{"current_position":0-100,"leader_position":0-100,"gap_analysis":"...","priority_themes":["t1","t2","t3","t4"],"closing_strategy":"..."}},
"competitive_landscape":{"leader":{"name":"...","url":"...","authority_factor":"...","analysis":"3-4ph"},"direct_competitor":{"name":"...","url":"URL VALIDE","authority_factor":"...","analysis":"3-4ph"},"challenger":{...},"inspiration_source":{...}},
"geo_citability":{"score":0-100,"readiness_level":"pioneer|ready|developing|basic|absent","analysis":"...","strengths":[],"weaknesses":[],"recommendations":[]},
"llm_visibility":{"citation_probability":0-100,"citation_breakdown":{"serp_presence":0-100,"structured_data_quality":0-100,"content_quotability":0-100,"brand_authority":0-100,"content_freshness":0-100,"business_intent_match":0-100,"self_citation_signals":0-100,"knowledge_graph_signals":0-100},"knowledge_graph_presence":"strong|moderate|weak|absent","analysis":"...","test_queries":[{"query":"...","purpose":"...","target_llms":["ChatGPT","Claude","Perplexity"]}]},
"conversational_intent":{"ratio":0-100,"analysis":"...","question_titles_detected":0,"total_titles_analyzed":0,"examples":["3-5 questions naturelles liées au business"],"recommendations":[]},
"zero_click_risk":{"at_risk_keywords":[{"keyword":"...","volume":0,"risk_level":"high|medium|low","sge_threat":"...","defense_strategy":"..."}],"overall_risk_score":0-100,"analysis":"..."},
"priority_content":{"missing_pages":[{"title":"...","rationale":"...","target_keywords":[],"expected_impact":"high|medium|low"}],"content_upgrades":[{"page":"...","current_issue":"...","upgrade_strategy":"..."}]},
"keyword_positioning":{"main_keywords":[{"keyword":"...","volume":0,"difficulty":0,"current_rank":"...","strategic_analysis":{"intent":"Transactionnel|Informatif|Décisionnel|Navigationnel","business_value":"High|Medium|Low","pain_point":"...","recommended_action":"..."}}],"quick_wins":[{"keyword":"...","volume":0,"current_rank":15,"action":"..."}],"content_gaps":[{"keyword":"mot-clé pertinent non classé","volume":100,"priority":"high|medium|low","action":"Créer une page dédiée..."}],"opportunities":["..."],"competitive_gaps":["..."],"recommendations":["..."],"missing_terms":[{"term":"terme clé absent","importance":"critical|important|optional","competitor_usage":"Utilisé par X concurrents","suggested_placement":"Où et comment l'intégrer"}],"semantic_density":{"score":0-100,"verdict":"optimal|acceptable|thin|critical","analysis":"Analyse densité sémantique","vs_competitors":"Comparaison vs top SERP","top_missing_clusters":["cluster 1","cluster 2"]},"serp_recommendations":[{"action":"Action concrète","expected_impact":"high|medium|low","difficulty":"easy|medium|hard","timeframe":"délai estimé"}],"alternative_strategy":null},
"market_data_summary":{"total_market_volume":0,"keywords_ranked":0,"keywords_analyzed":0,"average_position":0,"data_source":"dataforseo|fallback"},
"executive_roadmap":[{"title":"...","prescriptive_action":"4-5ph","strategic_rationale":"...","expected_roi":"High|Medium|Low","category":"Identité|Contenu|Autorité|Social|Technique","priority":"Prioritaire|Important|Opportunité"}],
"client_targets":{"primary":[{"market":"B2B|B2C|B2B2C","b2b":{"segment":"TPE/Indépendants|PME|ETI/Grands comptes|Startups|Secteur public|Agences/Revendeurs","sector":"Tech/SaaS|E-commerce|Industrie|Santé|Finance|Immobilier|Éducation|Média|Juridique|Tourisme|Agriculture|Énergie|Autre","job_segment":"Marketing/Communication|SEO/SEA|Dev/IT|RH|Commercial|Direction générale|Achat|Logistique|R&D|Autre","role":"Dirigeant/CEO|CMO|CTO|Acheteur|Opérationnel","buying_frequency":"Ponctuel|Régulier|Récurrent|Saisonnier|Abonnement|Appel d'offres","payment_mode":"Abonnement mensuel|Abonnement annuel|Licence unique|Facturation projet|Crédit/Usage|Freemium→Payant"},"b2c":{"gender":"Homme|Femme|Enfant/Ado|Tous","age_range":"<18|18-25|26-35|36-50|51-65|65+","csp":"Étudiant|Employé|Cadre|Cadre supérieur|Profession libérale|Artisan/Commerçant|Fonctionnaire|Retraité|Sans emploi","purchasing_power":"Contraint|Classe moy. inf.|Classe moyenne|Classe moy. sup.|Aisé|Premium/Luxe|Ultra-premium","buying_frequency":"Ponctuel|Régulier|Récurrent|Saisonnier|Abonnement|Impulsif","payment_mode":"Abonnement mensuel|Abonnement annuel|Achat unique|Paiement fractionné|Crédit/Usage|Freemium→Payant"},"geo_scope":"Local|Régional|National|International","geo_country":"pays si détectable","intent":"Acheteur direct|Prescripteur|Utilisateur final|Chercheur d'info","maturity":"Awareness|Consideration|Decision|Loyalty","confidence":0.0-1.0,"evidence":"preuve issue du contenu crawlé"}],"secondary":[...],"untapped":[{"market":"...","rationale":"explication du potentiel non adressé","confidence":0.3-0.6,...}]},"business_model":{"model":"saas_b2b|saas_b2c|marketplace_b2b|marketplace_b2c|marketplace_b2b2c|ecommerce_b2c|ecommerce_b2b|media_publisher|service_local|service_agency|leadgen|nonprofit","confidence":0.0-1.0,"evidence":"preuve courte issue du contenu crawlé (panier, pricing, vendeurs tiers, articles…)"},
"executive_summary":"3-4ph CEO/CMO","overallScore":0-100,
"quotability":{"score":0-100,"quotes":["phrase citable 1","2","3"]},
"summary_resilience":{"score":0-100,"originalH1":"...","llmSummary":"10 mots max"},
"lexical_footprint":{"jargonRatio":0-100,"concreteRatio":0-100},
"expertise_sentiment":{"rating":1-5,"justification":"1ph"},
"red_team":{"flaws":["faille 1","preuve manquante 2","objection 3"]}}

RÈGLES:
- main_keywords: MIN 5 obligatoires avec strategic_analysis (intent,business_value,pain_point,recommended_action). Complète si <5 résultats DataForSEO. JAMAIS le nom de marque. 100% génériques.
- executive_roadmap: MIN 6 recs narratives dont ≥1 category "Social"
- direct_competitor: JAMAIS "${domain}". AUTRE domaine, même core business.
- profile_url: UNIQUEMENT URLs listées dans E-E-A-T ci-dessus. COPIE-COLLE. Max 2 profils avec URL. Sinon null.
- Fondateur: cite si CERTAIN. Sinon "fondateur non identifié". founder_authority="unknown" par défaut.
- eeat_score EVIDENCE-BASED: Crawlé: +1pt(AuthorJsonLD,Person/ProfilePage,Wikidata,Organization) +0.5pt(sameAs,AuthorBio,LI company,LI perso,Citations,CaseStudies). Max tech ~7pts. Inféré: +1-3pts marque connue. Sans signal tech: max 3. Avec tech sans incarnation: max 7. Avec incarnation: 7-9. 10: Wikidata ou marque certaine.
- MALUS AUTORITÉ PROPORTIONNÉ (business digital = SaaS, e-commerce, marketplace, plateforme, agence, média, app) : 0 backlink éditorial + domaine ≥2 ans → -2pts. 0 backlink éditorial + domaine <2 ans → -1pt. 1-3 backlinks éditoriaux → -0.5pt. 4+ backlinks éditoriaux → pas de malus. Mentions presse détectées (brand-mentions) → +0.5pt bonus. Un artisan, médecin ou commerce local n'est PAS concerné.
- PARADOXE VENDEUR: Si le site VEND un service X (audit EEAT, optimisation SEO, conseil en stratégie, etc.) mais N'EXHIBE PAS les signaux de X sur son propre site, c'est un paradoxe à signaler explicitement dans les failles. Exemple: un SaaS qui vend des audits E-E-A-T mais n'a aucun signal EEAT visible lui-même.
- NE PRÉTENDS PAS connaître: nb abonnés, existence GMB, fraîcheur posts. analysis thought_leadership: sépare "Signaux vérifiés" vs "Signaux estimés".
- proof_sources: pour chaque source sociale, qualifier le statut comme "verified" (URL crawlée trouvée), "inferred" (mentionné dans le contenu sans URL), ou "absent". NE JAMAIS qualifier comme "verified" sans preuve URL. NE JAMAIS inventer des profils.
- quotability: phrases factuelles autonomes citables. +33pts/citation.
- summary_resilience: résumé ≤10 mots. Score similarité H1/contenu.
- lexical_footprint: jargonRatio+concreteRatio=100. ATTENTION: "jargon" = UNIQUEMENT les formules vides/corporate sans substance (ex: "solutions innovantes", "accompagnement sur-mesure", "leader de la transformation"). La terminologie métier précise (ex: "assurance vie", "prévoyance collective", "taux de rendement", "SCPI") est du vocabulaire CONCRET, PAS du jargon. Un site professionnel avec du vocabulaire technique spécifique à son secteur doit avoir un concreteRatio élevé (75-95). Seuls les buzzwords creux sans valeur informative comptent comme jargon.
- expertise_sentiment: 1(générique/IA) à 5(expert terrain). COHÉRENCE TONALE: si le contenu utilise un ton générique/IA (formulations lisses, sans aspérité, sans opinion tranchée) tout en prétendant être expert → rating max 2. Un vrai expert a des opinions, utilise son vocabulaire métier, fait référence à son expérience.
- red_team: 3 failles/objections client sceptique. INCLURE le paradoxe vendeur si détecté.
- Base recommandations sur état des lieux SEO réel si fourni.
- missing_terms: MIN 3 termes clés que les concurrents SERP utilisent mais absents du site. Indiquer importance, usage concurrent, et placement suggéré.
- semantic_density: comparer la richesse sémantique du site vs les 3 premiers concurrents SERP. Score objectif.
- serp_recommendations: MIN 3 actions concrètes et actionnables pour améliorer le positionnement SERP.
- alternative_strategy: UNIQUEMENT si position très défavorable (>50, faible autorité, peu de leviers SEO). Sinon null. Si présent: répondre quoi/comment/combien. Rappeler qu'une action offsite a TOUJOURS des répercussions positives sur le ranking d'une URL. Types possibles: RP presse, partenariat (nommer l'entreprise idéale), stratégie vidéo réseaux sociaux, événement.
- client_targets: OBLIGATOIRE. Analyse le contenu, le pricing, le positionnement pour déduire les cibles. primary: 1-2 cibles (confidence>0.7). secondary: 1-2 cibles (confidence 0.4-0.7). untapped: exactement 2 cibles non adressées avec rationale. Pour chaque cible, remplir SOIT b2b SOIT b2c selon le market.
- JSON pur, sans virgules traînantes`;
}
