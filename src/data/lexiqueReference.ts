/**
 * Lexique de référence compact pour les agents (Félix, Stratège Cocoon).
 * Chaque terme a une définition courte (< 80 chars) pour injection dans les prompts système.
 * Ce fichier est la SSOT des définitions Crawlers.fr.
 */

export interface LexiqueEntry {
  term: string;
  def: string;
}

export const LEXIQUE_REFERENCE: LexiqueEntry[] = [
  // ── SEO ──
  { term: 'SEO', def: "Optimisation pour les moteurs de recherche (Google, Bing)." },
  { term: 'GEO', def: "Optimisation pour les moteurs IA génératifs (ChatGPT, Perplexity, Gemini)." },
  { term: 'AEO', def: "Optimisation pour les moteurs de réponse directe (featured snippets, PAA)." },
  { term: 'SERP', def: "Page de résultats d'un moteur de recherche." },
  { term: 'E-E-A-T', def: "Experience, Expertise, Authoritativeness, Trustworthiness — critères qualité Google." },
  { term: 'Backlink', def: "Lien entrant depuis un autre site. Améliore l'autorité SEO." },
  { term: 'Canonical URL', def: "Balise HTML indiquant la version principale d'une page (anti-duplicata)." },
  { term: 'Crawl Budget', def: "Nombre de pages que Google explore sur un site par session." },
  { term: 'Domain Authority', def: "Score 0-100 estimant la capacité de classement d'un domaine." },
  { term: 'Featured Snippet', def: "Encadré position zéro répondant directement à une question Google." },
  { term: 'Maillage Interne', def: "Liens reliant les pages d'un même site entre elles." },
  { term: 'Cannibalisation SEO', def: "Plusieurs pages se disputent le même mot-clé, diluant l'autorité." },
  { term: 'Page Orpheline', def: "Page non liée par aucune autre page du site." },
  { term: 'Cluster Thématique', def: "Groupe de pages autour d'un sujet central relié par liens internes." },
  { term: 'Page Pilier', def: "Page centrale et exhaustive d'un cluster thématique." },
  { term: 'Autorité Topique', def: "Reconnaissance qu'un site fait autorité sur un sujet spécifique." },
  { term: 'Content Gap', def: "Lacune de contenu par rapport aux concurrents ou attentes utilisateurs." },
  { term: 'Keyword Gap', def: "Mots-clés couverts par les concurrents mais pas par le site." },
  { term: 'Quick Win SEO', def: "Optimisation à fort impact et faible effort (titre, meta, lien cassé)." },
  { term: 'Noindex', def: "Directive interdisant l'indexation d'une page par les moteurs." },
  { term: 'Chaîne de Redirection', def: "Cascade de redirections (A→B→C) diluant le SEO et le temps de chargement." },
  { term: 'Empreinte Lexicale', def: "Distance sémantique entre contenu et cibles (primaire, secondaire, inexploitée)." },

  // ── GEO & IA ──
  { term: 'LLM', def: "Grand modèle de langage (GPT, Claude, Gemini)." },
  { term: 'Citation IA', def: "Mention d'un site comme source dans une réponse LLM." },
  { term: 'Citabilité', def: "Capacité d'un contenu à être cité par les LLMs." },
  { term: 'Hallucination IA', def: "Erreur d'un LLM générant des informations fausses." },
  { term: 'RAG', def: "Retrieval-Augmented Generation — recherche + génération pour plus de précision." },
  { term: 'Prompt', def: "Instruction envoyée à un LLM pour obtenir une réponse." },
  { term: 'Token', def: "Unité traitée par un LLM (≈ 4 caractères)." },
  { term: 'Embedding', def: "Représentation vectorielle d'un texte capturant son sens sémantique." },
  { term: 'llms.txt', def: "Fichier listant les pages clés pour les LLMs (complément de robots.txt)." },
  { term: 'GPTBot', def: "Crawler d'OpenAI pour entraîner les modèles GPT." },
  { term: 'ClaudeBot', def: "Crawler d'Anthropic pour entraîner Claude." },
  { term: 'PerplexityBot', def: "Crawler de Perplexity pour alimenter ses réponses." },
  { term: 'Google-Extended', def: "User-agent contrôlant l'accès de Gemini/Bard au contenu." },
  { term: 'SGE', def: "Search Generative Experience — réponses IA dans les résultats Google." },

  // ── Attribution IA (Sprint 2) ──
  { term: 'Attribution IA', def: "Lien causal entre un crawl bot IA et la visite humaine qu'il a générée." },
  { term: 'Fenêtre d\'attribution', def: "Période (30 jours stricts chez Crawlers) durant laquelle un crawl bot peut être crédité." },
  { term: 'Multi-touch pondéré', def: "Modèle attribuant un poids exponentiel décroissant à chaque crawl bot dans la fenêtre." },
  { term: 'Session fingerprint', def: "Identifiant anonyme SHA-256(UA+IP) déduplicant les visiteurs sans stocker l'IP." },
  { term: 'Top attributed bot', def: "Crawler IA avec le poids le plus élevé pour une visite humaine donnée." },
  { term: 'Bouclier Cloudflare', def: "Worker placé devant le site qui journalise et qualifie chaque requête bot IA." },

  // ── Performance ──
  { term: 'Core Web Vitals', def: "Métriques perf Google : LCP, INP, CLS." },
  { term: 'LCP', def: "Largest Contentful Paint — temps de chargement du plus grand élément (< 2.5s)." },
  { term: 'INP', def: "Interaction to Next Paint — réactivité aux interactions (remplace FID)." },
  { term: 'CLS', def: "Cumulative Layout Shift — stabilité visuelle (< 0.1)." },
  { term: 'FCP', def: "First Contentful Paint — premier élément affiché." },
  { term: 'TTFB', def: "Time To First Byte — temps de réponse serveur." },
  { term: 'Lazy Loading', def: "Chargement différé des images visibles à l'écran." },
  { term: 'CDN', def: "Réseau de distribution de contenu pour accélérer le chargement." },

  // ── Crawlers.fr — Outils ──
  { term: 'Audit Expert', def: "Audit SEO 168 critères en 5 min. Gratuit 1x/jour." },
  { term: 'Audit Stratégique IA', def: "Audit avancé avec score IAS et plan d'action. 1 crédit." },
  { term: 'Audit Comparé', def: "Benchmark vs 3 concurrents (SEO, GEO, perf, contenu). 4 crédits." },
  { term: 'Matrice d\'Audit', def: "Moteur d'audit sur-mesure avec import de critères. Double scoring." },
  { term: 'Cocon Sémantique 3D', def: "Visualisation et optimisation du maillage interne en graphe 3D." },
  { term: 'Content Architect', def: "Générateur de contenus E-E-A-T avec 7 panneaux et publication CMS." },
  { term: 'Code Architect', def: "Générateur de code correctif SEO : meta, JSON-LD, Schema.org." },
  { term: 'Crawl Multi-Pages', def: "Crawler technique jusqu'à 5000 pages (Pro Agency)." },

  // ── Crawlers.fr — Scores ──
  { term: 'Score IAS', def: "Indice d'Alignement Stratégique — 23 variables, 4 axes. > 70 = bon." },
  { term: 'Score GEO', def: "Visibilité dans les réponses IA. Gratuit sans inscription." },
  { term: 'Visibilité LLM', def: "Taux de citation dans 4 LLMs en parallèle." },
  { term: 'Part de Voix', def: "40% LLM + 35% SERP + 25% ETV." },
  { term: 'Triangle Prédictif', def: "Prédiction trafic 90j via corrélation GSC/GA4. MAPE < 15%." },
  { term: 'Score Crawlers', def: "Score télémétrie par crawl HTML. Aucune IA." },
  { term: 'Score Parsé', def: "Score LLM (Gemini Flash) sur évaluation sémantique." },
  { term: 'Scoring Hybride', def: "11 critères télémétrie + 3 critères LLM pour vision complète." },

  // ── Crawlers.fr — Agents ──
  { term: 'Félix', def: "Assistant SAV intelligent. Navigation, scores, questions SEO/GEO." },
  { term: 'Stratège Cocoon', def: "Agent IA du cocon sémantique : diagnostics + plans stratégiques." },
  { term: 'Parménion', def: "Orchestrateur autonome : Audit → Diagnostic → Prescription → Exécution." },
  { term: 'TIM', def: "Tracked Intelligence Memory — mémoire contextuelle persistante." },

  // ── Crawlers.fr — Architecture ──
  { term: 'Cascade de Crawl', def: "Fetch Natif → Spider.cloud → Firecrawl (marge 75%)." },
  { term: 'Stratégie 360°', def: "4 diagnostics parallèles + plan priorisé + 3 axes de développement." },
  { term: 'Autopilote', def: "Mode automatisé de Parménion avec seuils de risque configurables." },
  { term: 'Auto-Maillage IA', def: "IA trouvant les meilleurs emplacements d'ancres de liens internes." },
  { term: 'Architect Workbench', def: "Table centralisée priorisant les findings de tous les diagnostics." },
  { term: 'Télémétrie', def: "Mesure automatique par crawl HTML : balises, Schema.org, liens." },
  { term: 'Heuristique', def: "Score calculé par règles pondérées sur signaux bruts." },
  { term: 'Conversion Optimizer', def: "Audit UX/CRO contextuel sur 8 axes : ton, CTAs, lisibilité, mobile, mots-clés, alignement, conversion et chunkability IA." },
  { term: 'Analyse de Logs', def: "Analyse des logs serveur pour comprendre le comportement des bots sur votre site." },
  { term: 'Budget Crawl', def: "Nombre de pages que Google explore sur un site par session. Optimisable via l'analyse de logs." },
  { term: 'Récurrence de Crawl', def: "Fréquence à laquelle un bot revient explorer une page. Indicateur de priorité perçue." },
  { term: 'Bot IA Crawler', def: "Robot d'indexation IA (GPTBot, ClaudeBot, PerplexityBot) qui explore les sites pour alimenter les LLMs." },
  { term: 'Hit de Crawl', def: "Requête HTTP d'un bot sur une page. Le ratio hits/pages révèle l'efficacité du budget crawl." },
  { term: 'Gaspillage de Crawl', def: "Pages crawlées inutilement (404, redirections, paramètres) consommant le budget crawl." },

  // ── Crawlers.fr — Métriques avancées ──
  { term: 'SPO', def: "Score de Priorité d'Optimisation — 8 signaux, 0-100. Priorise les actions SEO par ROI." },
  { term: 'ETV', def: "Estimated Traffic Value — valeur monétaire du trafic organique (volume × CPC)." },
  { term: 'CTR Gap', def: "Écart entre CTR réel (GSC) et CTR attendu pour la position SERP." },
  { term: 'Voice DNA', def: "ADN de Marque — profil tonal persistant pour la génération de contenu IA." },
  { term: 'Marina', def: "Module de prospection B2B : audit externe + pipeline LinkedIn assisté." },
  { term: 'Drop Detector', def: "Diagnostic de Chute — détection automatique des baisses de trafic avec cause probable." },
  { term: 'Observatoire', def: "Veille sectorielle autonome quotidienne (updates Google, tendances, concurrence)." },
  { term: 'Identity Card', def: "Carte d'identité site — enrichissement automatique du profil via APIs externes." },
  { term: 'Fair Use', def: "Quotas d'utilisation équitables par plan (crawls, contenus, audits par mois)." },
  { term: 'Smart Recommendations', def: "Moteur de gating progressif débloquant les fonctionnalités par maturité SEO." },

  // ── Marketing & Business ──
  { term: 'CRO', def: "Conversion Rate Optimization — optimisation du taux de conversion d'un site." },
  { term: 'SEA', def: "Search Engine Advertising — publicité payante sur Google Ads, Bing Ads." },
  { term: 'KPI', def: "Key Performance Indicator — indicateur clé de performance mesurable." },
  { term: 'ROI', def: "Return On Investment — ratio rentabilité d'un investissement SEO/GEO." },
  { term: 'CTA', def: "Call To Action — bouton ou texte incitant l'utilisateur à agir." },
  { term: 'B2B', def: "Business to Business — échanges commerciaux entre entreprises." },
  { term: 'B2C', def: "Business to Consumer — vente directe aux consommateurs finaux." },
  { term: 'SaaS', def: "Software as a Service — logiciel accessible en ligne par abonnement." },
  { term: 'RGPD', def: "Règlement Général sur la Protection des Données — cadre juridique européen." },

  // ── APIs ──
  { term: 'DataForSEO', def: "API de données SERP et mots-clés." },
  { term: 'PageSpeed Insights API', def: "API Google pour Core Web Vitals et Lighthouse." },
  { term: 'GSC', def: "Google Search Console — impressions, clics, positions." },
  { term: 'GA4', def: "Google Analytics 4 — analyse de trafic par événements." },
  { term: 'GMB', def: "Google My Business — fiche locale, avis, performances." },
  { term: 'Spider.cloud', def: "Service de crawl web (fallback dans la cascade)." },
  { term: 'Firecrawl', def: "API de crawl pour pages JavaScript-heavy." },
  { term: 'IKtracker', def: "CMS partenaire avec intégration bidirectionnelle." },
  { term: 'WordPress REST API', def: "Interface de publication et synchronisation avec WP." },

  // ── Technique ──
  { term: 'JSON-LD', def: "Format de données structurées recommandé par Google." },
  { term: 'Schema.org', def: "Vocabulaire standardisé de données structurées." },
  { term: 'Robots.txt', def: "Fichier indiquant aux robots les pages à crawler ou ignorer." },
  { term: 'Sitemap XML', def: "Fichier listant les URLs importantes pour l'indexation." },
  { term: 'Hreflang', def: "Attribut HTML indiquant langue et région d'une page." },
  { term: 'Open Graph', def: "Métadonnées définissant l'aperçu social d'une page." },
  { term: 'HTTPS', def: "Protocole sécurisé chiffrant les communications (SSL/TLS)." },
  { term: '301 Redirect', def: "Redirection permanente transférant l'autorité SEO." },
  { term: 'Données Structurées', def: "Balisage JSON-LD/Schema.org pour machines et IA." },
  { term: 'Crédits Crawlers', def: "Unité de consommation pour fonctionnalités avancées." },
  { term: 'Pro Agency', def: "Abonnement premium 29€/mois (Cocon, Crawl, GMB, 1 collab)." },
  { term: 'Pro Agency+', def: "Abonnement premium étendu 79€/mois (2 collabs, limites étendues)." },
];

/**
 * Génère un bloc de texte compact pour injection dans un prompt système.
 * Format: "TERME : définition\n" pour chaque entrée.
 */
export function buildLexiquePromptBlock(): string {
  return `\n# LEXIQUE DE RÉFÉRENCE CRAWLERS.FR\nUtilise ces définitions quand l'utilisateur mentionne un terme technique. Tu peux renvoyer vers /lexique pour la définition complète.\n\n` +
    LEXIQUE_REFERENCE.map(e => `- **${e.term}** : ${e.def}`).join('\n') + '\n';
}
