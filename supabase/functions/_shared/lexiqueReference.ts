/**
 * Lexique de référence compact pour les agents (Félix, Stratège Cocoon).
 * Injecté dans les prompts système pour que les agents puissent définir les termes pros.
 */

export const LEXIQUE_PROMPT_BLOCK = `
# LEXIQUE DE RÉFÉRENCE CRAWLERS.FR
Quand l'utilisateur mentionne un terme technique, utilise ces définitions. Tu peux renvoyer vers /lexique pour plus de détails.

- **SEO** : Optimisation pour les moteurs de recherche (Google, Bing).
- **GEO** : Optimisation pour les moteurs IA génératifs (ChatGPT, Perplexity, Gemini).
- **AEO** : Optimisation pour les moteurs de réponse directe (featured snippets, PAA).
- **E-E-A-T** : Experience, Expertise, Authoritativeness, Trustworthiness — critères qualité Google.
- **SERP** : Page de résultats d'un moteur de recherche.
- **LLM** : Grand modèle de langage (GPT, Claude, Gemini).
- **SGE** : Search Generative Experience — réponses IA dans les résultats Google.
- **RAG** : Retrieval-Augmented Generation — recherche + génération pour plus de précision.
- **Citation IA** : Mention d'un site comme source dans une réponse LLM.
- **Citabilité** : Capacité d'un contenu à être cité par les LLMs.
- **Hallucination IA** : Erreur d'un LLM générant des informations fausses.
- **Cannibalisation SEO** : Plusieurs pages se disputent le même mot-clé, diluant l'autorité.
- **Page Orpheline** : Page non liée par aucune autre page du site.
- **Maillage Interne** : Liens reliant les pages d'un même site entre elles.
- **Cluster Thématique** : Groupe de pages autour d'un sujet central relié par liens internes.
- **Page Pilier** : Page centrale et exhaustive d'un cluster thématique.
- **Autorité Topique** : Reconnaissance qu'un site fait autorité sur un sujet spécifique.
- **Content Gap** : Lacune de contenu par rapport aux concurrents.
- **Keyword Gap** : Mots-clés couverts par les concurrents mais pas par le site.
- **Quick Win SEO** : Optimisation à fort impact et faible effort.
- **Empreinte Lexicale** : Distance sémantique entre contenu et cibles (primaire, secondaire, inexploitée).
- **Core Web Vitals** : Métriques perf Google : LCP, INP, CLS.
- **LCP** : Largest Contentful Paint — temps de chargement du plus grand élément (< 2.5s).
- **INP** : Interaction to Next Paint — réactivité aux interactions.
- **CLS** : Cumulative Layout Shift — stabilité visuelle (< 0.1).
- **Audit Expert** : Audit SEO 168 critères en 5 min. Gratuit 1x/jour.
- **Audit Stratégique IA** : Audit avancé avec score IAS et plan d'action. 1 crédit.
- **Audit Comparé** : Benchmark vs 3 concurrents. 4 crédits.
- **Matrice d'Audit** : Moteur d'audit sur-mesure avec import de critères. Double scoring.
- **Cocon Sémantique 3D** : Visualisation et optimisation du maillage interne en graphe 3D.
- **Content Architect** : Générateur de contenus E-E-A-T avec 7 panneaux et publication CMS.
- **Code Architect** : Générateur de code correctif SEO : meta, JSON-LD, Schema.org.
- **Crawl Multi-Pages** : Crawler technique jusqu'à 5000 pages (Pro Agency).
- **Score IAS** : Indice d'Alignement Stratégique — 23 variables, 4 axes. > 70 = bon.
- **Score GEO** : Visibilité dans les réponses IA. Gratuit sans inscription.
- **Visibilité LLM** : Taux de citation dans 4 LLMs en parallèle.
- **Part de Voix** : 40% LLM + 35% SERP + 25% ETV.
- **Triangle Prédictif** : Prédiction trafic 90j via corrélation GSC/GA4. MAPE < 15%.
- **Score Crawlers** : Score télémétrie par crawl HTML. Aucune IA.
- **Score Parsé** : Score LLM (Gemini Flash) sur évaluation sémantique.
- **Scoring Hybride** : 11 critères télémétrie + 3 critères LLM.
- **Télémétrie** : Mesure automatique par crawl HTML : balises, Schema.org, liens.
- **Heuristique** : Score calculé par règles pondérées sur signaux bruts.
- **Félix** : Assistant SAV intelligent. Navigation, scores, questions SEO/GEO.
- **Stratège Cocoon** : Agent IA du cocon sémantique : diagnostics + plans stratégiques.
- **Parménion** : Orchestrateur autonome : Audit → Diagnostic → Prescription → Exécution.
- **TIM** : Tracked Intelligence Memory — mémoire contextuelle persistante.
- **Cascade de Crawl** : Fetch Natif → Spider.cloud → Firecrawl (marge 75%).
- **Stratégie 360°** : 4 diagnostics parallèles + plan priorisé + 3 axes.
- **Autopilote** : Mode automatisé de Parménion avec seuils de risque configurables.
- **Auto-Maillage IA** : IA trouvant les meilleurs emplacements d'ancres internes.
- **Conversion Optimizer** : Audit UX/CRO contextuel sur 7 axes : ton, CTAs, lisibilité, mobile, mots-clés.
- **Analyse de Logs** : Analyse des logs serveur pour comprendre le comportement des bots sur un site.
- **Budget Crawl** : Nombre de pages que Google explore sur un site par session. Optimisable via l'analyse de logs.
- **Récurrence de Crawl** : Fréquence à laquelle un bot revient explorer une page. Indicateur de priorité perçue.
- **Bot IA Crawler** : Robot d'indexation IA (GPTBot, ClaudeBot, PerplexityBot) explorant les sites pour alimenter les LLMs.
- **Hit de Crawl** : Requête HTTP d'un bot sur une page. Le ratio hits/pages révèle l'efficacité du budget crawl.
- **Gaspillage de Crawl** : Pages crawlées inutilement (404, redirections, paramètres) consommant le budget crawl.
- **JSON-LD** : Format de données structurées recommandé par Google.
- **Schema.org** : Vocabulaire standardisé de données structurées.
- **Robots.txt** : Fichier indiquant aux robots les pages à crawler ou ignorer.
- **llms.txt** : Fichier listant les pages clés pour les LLMs.
- **Hreflang** : Attribut HTML indiquant langue et région d'une page.
- **GSC** : Google Search Console — impressions, clics, positions.
- **GA4** : Google Analytics 4 — analyse de trafic par événements.
- **GMB** : Google My Business — fiche locale, avis, performances.
- **DataForSEO** : API de données SERP et mots-clés.
- **PageSpeed Insights API** : API Google pour Core Web Vitals et Lighthouse.
- **Crédits Crawlers** : Unité de consommation pour fonctionnalités avancées.
- **Pro Agency** : Abonnement premium 29€/mois (Cocon, Crawl, GMB, 1 collab).
- **Pro Agency+** : Abonnement premium étendu 79€/mois (2 collabs, limites étendues).
`;
