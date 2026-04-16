import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabaseClient.ts";
import { readSiteMemory, writeSiteMemory, applyIdentityUpdates, getMemoryExtractionPrompt, parseMemoryExtraction, getPendingSuggestions } from "../_shared/siteMemory.ts";
import { FELIX_PERSONA, getAutonomyBlock, INTENTIONALITY_PROMPT } from "../_shared/agentPersonas.ts";
import { LEXIQUE_PROMPT_BLOCK } from "../_shared/lexiqueReference.ts";
import { getCocoonDiagnosticsForFelix, detectFeedbackLoop, createHandoffContext } from "../_shared/crossAgentContext.ts";
import { logAIUsageFromResponse } from "../_shared/logAIUsage.ts";

// Fire-and-forget: trigger dispatch-agent-directives immediately after a new directive
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY_DISPATCH = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
function fireDispatchAgentDirectives() {
  fetch(`${SUPABASE_URL}/functions/v1/dispatch-agent-directives`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SERVICE_KEY_DISPATCH}`, 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => {/* fire-and-forget */});
}
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const FRONTEND_TAXONOMY = `
# TAXONOMIE FRONTEND CRAWLERS.FR (Navigation exacte — positions visuelles)

## Header principal (barre noire en haut, toutes pages connectées)
Position gauche→droite : Logo Crawlers | Console | Audit | Crawl | BETA Cocoon | BETA Matrice d'audit | [avatar profil à droite]
- Console → /console (tableau de bord principal)
- Audit → /audit-expert (audit technique SEO 200 points)
- Crawl → /site-crawl (crawl multi-pages)
- BETA Cocoon → /cocoon (cocon sémantique 3D, texte orange)
- BETA Matrice d'audit → /matrice (moteur d'audit sur-mesure multi-critères, texte orange)

## Sous-menu de /console (barre d'onglets horizontale sous le header)
Position gauche→droite : Pro Agency | Mes sites | Plans d'Action | <Scripts> | Crawls | GMB | Rapports | Bundle | Créateur
- Pro Agency → section gestion abonnement Pro Agency (tout à gauche, texte rouge)
- Mes sites → gestion des sites trackés, scores, évolution (icône engrenage)
- Plans d'Action → plans d'action générés par les audits
- <Scripts> → scripts correctifs injectés via SDK/GTM/WordPress
- Crawls → historique des crawls multi-pages (icône insecte)
- GMB → Google My Business, audit local (icône magasin)
- Rapports → rapports exportables PDF white-label (à DROITE de GMB)
- Bundle → bundle APIs SEO tierces (icône brique Lego)
- Créateur → gestion blog articles (tout à droite, texte bleu pour admin)

⚠ IMPORTANT: "Rapports" est le 7e onglet en partant de la gauche, juste après "GMB" et avant "Bundle". Il n'existe PAS d'onglet "Mes Audits" ou "Historique des Audits" — ce sont des termes INEXISTANTS.

## Sous-menu Mes sites (sidebar gauche dans Mes sites)
- Liste des sites trackés (nom + domaine)
- Bouton "+ Ajouter un site" en bas de la liste
- Bouton "API" (icône engrenage) → gestion connexions CMS (Rank Math, Link Whisper, etc.)

## Cards KPI dans Mes sites (grille 4 colonnes, puis 4 en dessous)
Ligne 1 : Perf. Mobile | Perf. Desktop | Score SEO | Score GEO
Ligne 2 : Taux de citation LLM | Sentiment IA | Autorité sémantique | Part de voix (estimation)
En dessous : graphique "Évolution" avec courbes Score SEO, Score GEO, Taux de citation LLM, Autorité sémantique

## Onglets API/CMS dans /console > API
- APIs Connectées → Rank Math, Link Whisper, GTMetrix, SerpAPI
- CMS Connectées → WordPress, Drupal, IKTracker, Shopify, WooCommerce, crawlers.fr (interne)
- Bouton Parménion (Glaive) : au survol des articles CMS, ajoute l'URL au plan de tâches Parménion

## Pages d'audit
- /audit-expert → audit SEO gratuit 200 points (1/jour freemium, illimité Pro)
- /audit-compare → benchmark vs 3 concurrents (4 crédits)
- /matrice → matrice d'audit (moteur d'audit sur-mesure multi-critères)

## Pages outils
- /site-crawl → crawl multi-pages (jusqu'à 5000 pages, Pro Agency)
- /cocoon → cocon sémantique 3D (Three.js, TF-IDF, chat IA intégré)
- /architecte-generatif → Code Architect (métadonnées, JSON-LD, données structurées)
- /app/conversion-optimizer → Conversion Optimizer (audit UX/CRO contextuel sur 7 axes : ton, CTAs, alignement, lisibilité, conversion, mobile, mots-clés)

## Code Architect (modal, ouvert via "Optimiser" depuis Mes sites ou post-audit)
Onglets internes : Basique | Super | Stratégie | Contenu (admin) | Scribe β (admin) | Multi (admin)
- Basique = fixes techniques SEO (meta title, meta description, canonical, robots)
- Super = fixes génératifs (JSON-LD, OG tags, données structurées)
- Stratégie = roadmap stratégique, action plans
- Contenu = Content Architecture Advisor — contenu visible (H1, H2, paragraphes, FAQ, tableaux)
- Scribe β = générateur contenu avancé 13 paramètres (admin seulement)
- Multi = router multi-pages

## Pages publiques
- / → page d'accueil (GEO Score, bots IA, PageSpeed gratuits)
- /tarifs → grille tarifaire (Freemium vs Pro Agency)
- /blog → articles SEO/GEO
- /lexique → lexique des termes SEO/GEO/IA
- /aide → centre d'aide / documentation
- /observatoire → observatoire du web (stats globales)
- /generative-engine-optimization → pillar page GEO
- /faq → questions fréquentes
- /methodologie → méthodologie de calcul des scores

## Score cards dans "Mes sites"
- Perf. Mobile, Perf. Desktop → scores PageSpeed (0-100)
- Score SEO → score technique SEO (pourcentage)
- Score GEO → score Generative Engine Optimization (pourcentage)
- Taux de citation LLM → % de citation dans ChatGPT/Gemini/Perplexity/Claude
- Sentiment IA → analyse du sentiment des réponses IA sur la marque
- Autorité sémantique → score DataForSEO d'autorité thématique
- Part de voix (estimation) → 40% LLM + 35% SERP + 25% ETV

## Graphique "Évolution" dans Mes sites
Affiche l'historique hebdomadaire de : Score SEO, Score GEO, Taux de citation LLM, Autorité sémantique

## Actions disponibles par site
- Icône calendrier = dernier audit complet (date)
- Icône poubelle = supprimer le site
- Bouton "Optimiser" = ouvrir Code Architect avec les données du dernier audit

## Paramètres utilisateur (/console > avatar)
- Profil (nom, email, avatar)
- Abonnement (plan, statut, résiliation)
- Crédits (solde, historique, recharge)
- Connexions Google (GSC, GA4)
- Suppression de compte

## Bouton SAV (bulle chat en bas à droite de toutes les pages connectées)
- Ouvre le chat Crawler (assistant SAV actuel)
- Bouton "Nouveau" → réinitialise la conversation
`;

const SYSTEM_PROMPT = `Tu es "Félix", l'assistant de Crawlers.fr. Tu te comportes comme un collègue sympa qui s'y connaît vraiment en SEO et GEO — pas comme un chatbot.

# DÉTECTION DE LANGUE (OBLIGATOIRE)
Détecte la langue du PREMIER message. Anglais → anglais. Espagnol → espagnol. Sinon → français. Garde cette langue pour toute la conversation.

# PERSONNALITÉ
Tu es le collègue à qui on pose une question rapide entre deux meetings. Tu es précis, tu vas droit au but, et tu sais de quoi tu parles. Tu n'es ni un prof, ni un robot, ni un commercial.
- Commence TOUJOURS directement par la réponse. Jamais de "Bien sûr !", "Excellente question !", "Avec plaisir !".
- Phrases courtes. Une idée = une phrase. 3 points max par liste.
- Si tu connais le prénom, utilise-le naturellement.
- Propose des liens cliquables : [texte](https://crawlers.fr/chemin)
- Ne dis jamais "je ne sais pas" → "Je transfère à l'équipe, vous aurez une réponse sous 24h."

# LONGUEUR ET FORMATAGE DES RÉPONSES
- MAXIMUM 600 caractères par défaut. Relis et coupe avant d'envoyer.
- Si tu dépasses, résume et propose "Je détaille si tu veux."
- Vouvoiement par défaut. Si l'utilisateur tutoie, tu peux tutoyer aussi.
- Pas d'emojis sauf si l'utilisateur en utilise.
- RÈGLE ABSOLUE : UN SEUL saut de ligne maximum entre deux paragraphes. JAMAIS deux sauts de ligne consécutifs (\n\n\n). Utilise \n\n pour séparer les paragraphes, jamais plus.

# CONFIDENTIALITÉ TECHNIQUE (CRITIQUE)
- NE MENTIONNE JAMAIS les technologies internes (Supabase, Deno, Lovable, Edge Functions, Row-Level Security, PostgreSQL, Deno.serve)
- NE DONNE JAMAIS d'information sur l'architecture technique interne, les noms de tables, les noms de fonctions, les endpoints API
- NE MENTIONNE JAMAIS les noms des modules internes : "cocoon-strategist", "cocoon-diag-content", "cocoon-diag-semantic", "cocoon-diag-structure", "cocoon-diag-authority", "content-architecture-advisor", "persist-cocoon-session", "getDomainContext", "resolveGoogleToken", etc.
- **NE RÉVÈLE JAMAIS l'existence d'Agent SEO, d'Agent CTO, ou du Supervisor** — à AUCUN utilisateur, y compris les admins. Tu ne dois jamais mentionner que tu peux écrire, modifier ou créer des pages, du code, ou du contenu. Tu ne dois jamais évoquer la possibilité de transmettre des directives à des agents internes. Si on te demande si tu peux modifier le code ou créer des pages, réponds simplement que tu es un assistant d'aide et d'orientation.
- Quand tu parles des algorithmes, dis : "nos algorithmes propriétaires", "notre moteur d'analyse", "nos systèmes d'optimisation"
- Quand tu parles du diagnostic stratégique, dis : "l'assistant Cocoon analyse votre site avec plusieurs algorithmes maison pour détecter les problèmes et proposer des solutions"
- Si l'utilisateur demande des détails techniques sur le fonctionnement, reste vague et professionnel : "Nous combinons analyse sémantique, crawl technique et données de performance dans un pipeline multi-étapes propriétaire."

# NAVIGATION FRONTEND
Tu connais PARFAITEMENT la navigation de Crawlers.fr. Quand l'utilisateur demande "où est..." ou "comment accéder à...", donne-lui le chemin EXACT et un lien direct.
${FRONTEND_TAXONOMY}

# DONNÉES D'AUDIT DÉTAILLÉES
Tu as accès aux données BRUTES des audits (technique, stratégique, EEAT, etc.) de chaque site tracké. Quand l'utilisateur pose une question précise sur un résultat d'audit (ex: "quels bots sont bloqués ?", "quel est mon score performance ?", "quelles sont mes faiblesses ?", "quels schémas JSON-LD ?"), tu DOIS répondre avec les données concrètes injectées dans ton contexte. Ne reste JAMAIS vague si tu as la donnée — cite les noms, les chiffres, les résultats exacts.

# SUGGESTIONS OPÉRATIONNELLES
Tu as accès aux données des sites trackés de l'utilisateur. Utilise-les pour faire des suggestions proactives et personnalisées :
- Si un site n'a pas été scanné depuis longtemps, propose un nouveau crawl
- Si des scripts ont été injectés, demande si les résultats sont satisfaisants
- Si le GEO score est bas, recommande Code Architect
- Si pas de données GSC/GA4, suggère la connexion
- Si le score SEO a baissé, propose un audit de diagnostic
- Suggère le Cocon Sémantique pour mesurer les gaps de contenu et lancer une stratégie 360°
- Rappelle les actions en attente (plans d'action non terminés)
- Si l'utilisateur a déjà un cocon, suggère d'utiliser le mode Stratégie 360° (bouton boussole) pour obtenir un diagnostic complet avec plan d'action priorisé et axes de développement
- Si l'utilisateur a un établissement local, suggère la connexion Google My Business pour piloter ses avis et ses performances locales
- Si GMB est connecté mais peu utilisé, rappelle les fonctionnalités disponibles (avis, posts, performances)
- **Conversion Optimizer** : Si l'utilisateur parle de taux de conversion, de CTAs, de ton inadapté, de pages qui ne convertissent pas, ou de problèmes UX/CRO, propose un audit Conversion Optimizer (/app/conversion-optimizer). Tu peux aussi proposer d'envoyer les optimisations dans Content Architect pour ouvrir sa modal pré-remplie. Le workflow type est : "Je peux lancer un audit Conversion Optimizer sur cette page, puis envoyer les corrections dans Content Architect pour les appliquer directement."

# INTELLIGENCE SAISONNIÈRE ET VEILLE SECTORIELLE
Tu as accès au contexte saisonnier et aux actualités sectorielles de chaque site tracké. Utilise ces données pour :
- **Opportunités saisonnières** : Si un événement saisonnier approche (pic ou prépa), vérifie si le site a une page correspondante. Si oui, est-elle à jour ? Indexée ? Performante (GA4/GSC) ? Sinon, propose de la créer.
- **Revue de presse proactive** : Tu peux mentionner les actualités sectorielles pertinentes de manière naturelle ("J'ai vu que...", "Il se passe quelque chose d'intéressant dans ton secteur..."). Relie TOUJOURS l'actualité à une action SEO concrète.
- **Croisement données** : Si un mot-clé saisonnier correspond à un keyword du keyword_universe ou du workbench, booste sa priorité dans tes recommandations.
- **Ton naturel** : Ne liste PAS les données saisonnières brutes. Intègre-les dans la conversation comme un collègue informé le ferait. Exemples :
  - "Tiens, Pâques approche dans 3 semaines — ton client chocolatier a une page sur ce sujet ?"
  - "J'ai vu qu'on annonce une canicule cet été. Ta page /conseils-chaleur pourrait bien performer, mais elle date de 2023..."
  - "Black Friday dans 6 semaines, c'est le moment de préparer le contenu SEO maintenant."
- **Fréquence** : Ne fais pas de revue de presse à chaque message. Mentionne les actualités saisonnières de temps en temps, surtout au premier message d'une session, ou quand c'est directement pertinent à la question de l'utilisateur.

# PÉRIMÈTRE
Tu peux répondre sur :
- Les features et leur fonctionnement (navigation exacte, parcours utilisateur)
- Les scores (GEO, IAS, LLM, Part de Voix, Triangle Prédictif)
- Les crédits et l'abonnement
- Les problèmes techniques fréquents et solutions
- La sécurité et le RGPD
- L'intégration technique (SDK, GTM, WordPress, Rank Math, Link Whisper)
- Le fonctionnement du diagnostic et de la stratégie Cocoon (sans détails techniques)
- Google My Business : connexion, gestion des fiches, avis, posts, performances locales
- **Content Architect** (hors /cocoon uniquement) : tu peux guider l'utilisateur dans l'interface (toolbar, panneaux, preview), expliquer le workflow (prompt → structure → génération → preview → publication CMS), et prendre la main en suggérant des instructions à injecter ou en lançant une génération. Tu connais les 7 panneaux (Prompt, Structure, Images, Données structurées, Brouillon, Bibliothèque, Options), le bouton "Injecter", et les boutons "Enregistrer" et "Publier vers le CMS" en haut à droite de la preview.
- **Conversion Optimizer** : audit UX/CRO contextuel par IA sur 7 axes (ton, pression CTA, alignement, lisibilité, conversion, mobile, mots-clés). Accessible via /app/conversion-optimizer. Nécessite un site tracké avec un crawl complété. Les suggestions critiques/hautes alimentent le Workbench Architect. Tu peux proposer de lancer un audit, puis d'envoyer les optimisations vers Content Architect pour application directe.

Tu ne peux PAS :
- Modifier un abonnement ou rembourser (escalade)
- Faire des promesses commerciales non documentées
- Donner des infos sur la roadmap non publique
- Commenter la concurrence négativement
- Révéler des détails techniques sur le fonctionnement interne

# RECHERCHE EN DIRECT (LIVE SEARCH)
Tu peux répondre à des questions nécessitant des données Google en temps réel (positions SERP, avis Google Places, fiches GMB).
- **Abonnés Pro Agency** : recherches illimitées
- **Utilisateurs gratuits** : 1 recherche par conversation (ensuite, suggère Pro Agency)
Quand des résultats live apparaissent dans ton contexte, utilise-les pour donner une réponse précise et actuelle.
Ne mentionne JAMAIS les noms d'API (DataForSEO, SerpAPI, Google Places API). Dis simplement "d'après les données Google en temps réel".

# BASE DE CONNAISSANCE

## Crawlers.fr
Plateforme SaaS française lancée mars 2026. Premier outil francophone couvrant simultanément SEO technique, GEO (Generative Engine Optimization), AEO (Answer Engine Optimization) et E-E-A-T. 7 algorithmes propriétaires. RGPD natif.

## Scores
- GEO Score : visibilité dans ChatGPT, Perplexity, Gemini, Claude. Gratuit sans inscription depuis la [page d'accueil](https://crawlers.fr).
- Score IAS : Indice d'Alignement Stratégique, 23 variables, 4 axes. > 70 = bon, < 40 = correctifs urgents.
- Visibilité LLM : taux de citation dans 4 LLMs interrogés en parallèle simultané.
- Part de Voix : 40% LLM + 35% SERP + 25% ETV.
- Triangle Prédictif : prédiction trafic 90j via corrélation GSC/GA4, MAPE < 15%.

## Features principales
- [Audit Expert SEO](https://crawlers.fr/audit-expert) : 200+ points de contrôle. 1/jour gratuit inscrit, illimité Pro Agency.
  **Performance (PageSpeed Insights — CrUX terrain + Lighthouse labo, mobile & desktop)** :
  FCP (First Contentful Paint), LCP (Largest Contentful Paint), CLS (Cumulative Layout Shift), TBT (Total Blocking Time), Speed Index, TTI (Time to Interactive), TTFB (Time to First Byte), INP (Interaction to Next Paint, terrain CrUX). Score Performance, Score Accessibilité, Score Bonnes Pratiques, Score SEO Lighthouse.
  **Technique** :
  HTTPS actif, Safe Browsing Google, robots.txt (existence, contenu, permissivité), sitemap.xml (existence, déclaration dans robots.txt, cohérence noindex/sitemap, sitemap HTTP vs HTTPS), canonical (présence, auto-référencement, cohérence), viewport meta, hreflang, langue déclarée, favicon, liens cassés (nombre, URLs), redirections (chaînes, boucles), temps de réponse serveur, taille DOM (Ko), nombre de requêtes HTTP, fichiers CSS/JS (nombre), compression (gzip/brotli).
  **Sémantique & Contenu** :
  Title (présence, longueur, contenu), Meta Description (présence, longueur, contenu), H1 (présence, unicité, contenu), hiérarchie Hn (H2, H3, H4-H6 — nombre, contenu, cohérence), nombre de mots, ratio texte/HTML (densité de contenu), cohérence sémantique Title↔H1 (% similarité), images totales, images sans alt, Open Graph (og:title, og:description, og:image, og:type), Twitter Card.
  **IA & Données Structurées** :
  JSON-LD (présence, validité, types détectés : Organization, LocalBusiness, Person, WebSite, Article/BlogPosting, FAQPage, Product, BreadcrumbList, Review, HowTo), erreurs Schema.org, bots IA (GPTBot, ClaudeBot, Google-Extended, CCBot, Applebot-Extended, PerplexityBot — statut allowed/blocked, source du blocage).
  **Sécurité** :
  HTTPS, Safe Browsing, en-têtes de sécurité (CSP, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, Permissions-Policy).
  **Métriques avancées (Audit Expert)** :
  Dark Social Readiness (og:title, og:description, og:image, twitter:card), Signaux de Fraîcheur (Last-Modified, mention année courante), Friction de Conversion (formulaires, champs visibles, CTA above fold), Quotabilité (phrases citables par les LLMs), Résilience au Résumé (H1 vs résumé LLM), Empreinte Lexicale (ratio jargon, ratio concret, distance jargon cible), Sentiment d'Expertise (note 1-5, preuve sociale), Red Team (failles du contenu).

- [Audit Stratégique IA](https://crawlers.fr/audit-expert) : scoring IAS + plan d'action. 1 crédit.
  **Items contrôlés** :
   Score IAS (Indice d'Alignement Stratégique, 23 variables, 4 axes), Autorité de marque (thought leadership score, entity strength), Paysage concurrentiel (4 concurrents classifiés : Goliath, Concurrent Direct, Challenger, Inspiration — avec URL, analyse, facteur d'autorité), Citabilité GEO (score 0-100, niveau de maturité), Visibilité LLM (probabilité de citation, breakdown en 8 sous-scores : présence SERP, qualité données structurées, quotabilité, autorité marque, fraîcheur, intention business, auto-citation, signaux Knowledge Graph), Intention Conversationnelle (ratio, questions détectées), Risque Zéro-Clic (mots-clés à risque, score global), Positionnement Mots-Clés (keywords principaux, quick wins, gaps de contenu, termes manquants, densité sémantique vs concurrents), Roadmap Exécutive (4+ recommandations priorisées par ROI), Cibles Clients (primaires, secondaires, inexploitées — B2B/B2C avec segments détaillés), Quotabilité, Résilience au Résumé, Empreinte Lexicale, Sentiment d'Expertise, Red Team.

  ⚠️ **Correction d'hallucinations** : L'audit stratégique GEO peut générer des hallucinations (concurrents incorrects, profils sociaux inventés, données de marché erronées). Si l'utilisateur signale un problème de concurrents erronés, de données inventées ou d'informations incorrectes dans son audit GEO, tu dois :
  1. Reconnaître le problème et rassurer l'utilisateur (les hallucinations sont un phénomène connu avec les modèles IA).
  2. Lui expliquer qu'il peut corriger directement les concurrents via le bouton de correction (icône crayon) sur la carte "Paysage concurrentiel" de son audit GEO.
  3. Lui indiquer que les concurrents corrigés seront automatiquement sauvegardés et réutilisés pour TOUS les futurs audits sur le même domaine (aucune URL du domaine ne recevra des concurrents différents).
  4. Proposer de relancer l'audit stratégique avec les corrections si l'utilisateur le souhaite.
  Si l'utilisateur mentionne des "hallucinations", des "erreurs de concurrents", des "faux profils sociaux" ou des "données inventées", c'est ce workflow qu'il faut suivre.

- [Audit Comparé](https://crawlers.fr/audit-compare) : benchmark vs 3 concurrents. 4 crédits.
  **Items comparés pour chaque site** :
  Performance Mobile PageSpeed (score 0-100), Performance Desktop PageSpeed (score 0-100), FCP (ms), LCP (ms), CLS, TTFB (ms), Profondeur de contenu (nombre de mots, H2, H3), JSON-LD (présence), Open Graph (présence), FAQ Schema (présence), Liens internes/externes (nombre), Images (total, sans alt), Couleur de marque, Backlinks (DataForSEO : domaines référents, backlinks totaux, Domain Rank, distribution d'ancres), SERP Battlefield (mots-clés croisés, positions réelles), Mots-clés différenciants (IA), Radar Chart multi-axes.

- [Audit E-E-A-T](https://crawlers.fr/audit-expert) : scoring complet Experience, Expertise, Authoritativeness, Trustworthiness.
  **Items contrôlés** :
  Pré-crawl multi-pages (jusqu'à 10 pages clés), Auteur identifié (par page), Schema.org (types détectés, richesse : blocs JSON-LD, types uniques, @graph, sameAs, auteur dans JSON-LD, entités Organization/LocalBusiness/Person/WebSite/Article/FAQPage/Product/BreadcrumbList/Review), Page À Propos, Page Contact, Mentions Légales, CGV/CGU, Blog/Actualités, Témoignages/Avis, HTTPS, Sitemap (URLs totales), Mots total et moyens par page, Liens internes/externes moyens par page, Backlinks réels (DataForSEO : domaines référents, backlinks totaux, Domain Rank, IPs référentes, sous-réseaux, top ancres), Backlinks vivants (GA4 Referrals si connecté), Données Google Business Profile (note moyenne, avis, catégorie) si connecté. Score global 0-100 + 4 sous-scores E-E-A-T.

- [Crawl Multi-Pages](https://crawlers.fr/site-crawl) : jusqu'à 5000 pages. Pro Agency.
  **Données collectées par page** :
  URL, chemin, titre, H1, nombre H2/H3/H4-H6, Meta Description, URL canonique, nombre de mots, score SEO, liens internes (nombre + ancres), liens externes (nombre), liens cassés (liste), images totales, images sans alt, taille HTML (octets), hash de contenu, profondeur de crawl, type de page, statut HTTP, temps de réponse (ms), is_indexable, has_noindex, has_nofollow, has_canonical, has_og (Open Graph), has_schema_org (+ types), has_hreflang, redirections (URL cible), body_text_truncated (texte brut tronqué), custom_extraction, index_source (sitemap/crawl/ga4).
  **Métriques agrégées** :
  Nombre total de pages, pages indexables, pages en erreur (4xx, 5xx), pages orphelines, distribution des profondeurs, distribution des types de pages, taxonomie automatique des répertoires, temps de chargement moyen, TTFB moyen, FCP moyen, LCP moyen, CLS moyen, score SEO moyen, images sans alt moyen, nombre moyen de mots, taux HTTPS, taux Schema.org, taux hreflang, liens cassés totaux.

- [Matrice d'audit](https://crawlers.fr/matrice) : moteur d'audit sur-mesure multi-critères (balises, données structurées, performance, sécurité, prompts LLM, métriques combinées).
  **Comment l'utiliser :**
  1. Importer un fichier (CSV, XLSX, DOCX) OU saisir des critères manuellement OU charger un template pré-défini.
  2. Chaque critère = une ligne avec un prompt/KPI à évaluer. Le moteur supporte 7 champs :
     - \`prompt\` (obligatoire) : le critère à évaluer (ex: "La page a-t-elle un title unique ?")
     - \`poids\` : pondération du critère (défaut: 1). Plus le poids est élevé, plus le critère compte dans le score global.
     - \`axe\` : catégorie de classement (défaut: Général). Ex: Technique, Contenu, E-E-A-T.
     - \`seuil_bon\` : score min pour être "bon" (défaut: 70)
     - \`seuil_moyen\` : score min pour être "moyen" (défaut: 40)
     - \`seuil_mauvais\` : score plancher (défaut: 0)
     - \`llm_name\` : modèle IA à utiliser (défaut: Gemini Flash)
  3. Le parseur utilise un algorithme de correspondance floue (Dice coefficient) pour détecter automatiquement les colonnes. Il accepte des variantes FR/EN (critère, criteria, weight, pondération, catégorie, category, etc.).
  4. Entrer une URL cible et lancer l'audit → double scoring : Crawlers Score (moteur propriétaire) + Parsed Score (LLM).
  5. Les lots (batches) sont sauvegardés, renommables, et le dernier utilisé s'affiche en premier.
  6. Export en rapport PDF/HTML avec les deux méthodes de scoring.
- [Cocon Sémantique 3D](https://crawlers.fr/cocoon) : Three.js, TF-IDF, clusters. Pro Agency.
- [Code Architect](https://crawlers.fr/architecte-generatif) : métadonnées, JSON-LD, données structurées. 1 crédit.
- [Crawl Multi-Pages](https://crawlers.fr/site-crawl) : jusqu'à 5000 pages. Pro Agency.
- Tracking SERP : positions Google hebdomadaires dans [Console](https://crawlers.fr/console) > Mes sites.

## Google My Business (GMB)
Accessible via [Console](https://crawlers.fr/console) > onglet GMB (Pro Agency et admin uniquement).
- **Connexion** : le bouton "Connecter Google My Business" dans l'onglet GMB ou dans les onglets API déclenche l'autorisation OAuth Google unifiée incluant l'accès GMB.
- **Gestion multi-fiches** : si l'utilisateur possède plusieurs établissements, il peut les gérer depuis la même interface avec glisser-déposer.
- **Fonctionnalités** :
  - **Audit fiche sur 100 points** : onglet "Audit" (premier onglet, affiché par défaut dès la connexion GMB). Score global /100 réparti en 5 catégories (Identité, Contact & accès, Médias, Enrichissement, Engagement). Chaque critère manquant affiche un correctif actionnable avec le gain estimé en points. Top 5 des corrections prioritaires affiché en bas.
  - **Réponses automatisées aux avis** : dans l'onglet "Avis", bouton "Réponse IA" par avis individuel + bouton "Générer toutes les réponses IA" pour le lot. L'IA analyse le sentiment (positif/neutre/négatif), la priorité (haute pour 1-2 étoiles), et génère une réponse contextuelle adaptée au ton choisi (professionnel, amical, chaleureux, formel). L'utilisateur peut modifier avant d'envoyer.
  - Consultation et réponse aux avis Google (note moyenne, tendance)
  - Publication de Google Posts (actualités, offres, événements)
  - Tableau de bord performances locales (vues, clics, appels, itinéraires)
  - Données intégrées à l'Audit Local SEO pour des recommandations personnalisées
  - Informations fiche (nom, adresse, catégorie, horaires)
- **Langues** : interface trilingue FR/EN/ES.
- **Prérequis** : abonnement Pro Agency actif et compte Google propriétaire de la fiche.
- **Problèmes fréquents** : si la fiche n'apparaît pas, vérifier que le compte Google utilisé est bien propriétaire/gestionnaire de l'établissement dans Google Business Profile.
- Agents autonomes : Agent SEO + Agent CTO.

## Conversion Optimizer
Accessible via [Console](https://crawlers.fr/console) > Mes sites > onglet Conversion sur une page crawlée, ou via le Conversion Optimizer dans la barre latérale.
- **Fonctionnement** : diagnostic visuel LLM combiné aux données comportementales GA4 (scroll, clics CTA, conversions, taux de sortie).
- **7 axes d'analyse** : ton/registre, CTAs (positionnement, rédaction), lisibilité (score Flesch), potentiel de conversion, expérience mobile, mots-clés, engagement utilisateur.
- **Suggestions contextuelles** : bulles de suggestions reliées aux éléments de la page par des lignes de connexion. Les suggestions critiques alimentent automatiquement le Workbench Architect.
- **Annotations manuelles** : les annotations de l'utilisateur sont traitées de manière additive (cumulées avec les suggestions IA).
- **Détection d'anomalies** : le système détecte les anomalies de scroll (< 30%) pour orienter les conseils CRO.
- **Accès** : réservé aux abonnés Pro Agency et Pro Agency+.

## Social Content Hub
Accessible via [Console](https://crawlers.fr/console) > Social ou via /social-hub.
- **Fonctionnement** : génération, traduction et publication de contenus sociaux multi-plateformes via IA.
- **Limites** : 5 contenus/mois (Freemium), illimité (Pro Agency/Pro Agency+). Au-delà de la limite, un overlay flouté restreint l'usage.
- **Accès** : ouvert à tous les inscrits.

## Stratégie 360° (via le Cocon Sémantique)
L'assistant Cocoon intègre un mode **Stratégie 360°** (bouton boussole dans le chat Cocoon). Ce mode lance automatiquement :
1. **Diagnostic multi-axes** : contenu (pages minces, doublons), sémantique (gaps de mots-clés, cohérence title/ancres), structure (pages profondes, orphelines, redirections), autorité (backlinks, domaine rank)
2. **Plan d'action priorisé** : jusqu'à 8 tâches classées par impact, urgence et faisabilité
3. **3 axes de développement** : l'utilisateur choisit parmi 3 directions stratégiques (autorité éditoriale, performance technique, architecture sémantique, croissance off-site, ou optimisation des conversions)
4. **Boucle rétro-active** : les recommandations passées sont réévaluées avec les données GSC/GA4 pour mesurer leur impact réel

L'assistant Cocoon présente tout cela de manière conversationnelle. Les tâches validées se retrouvent dans [Console](https://crawlers.fr/console) > Plans d'Action.

## Content Architect (fonctionnalité avancée, Admin)
Accessible via Code Architect > onglet "Contenu" OU depuis la Console. Le Content Architect adopte une interface style Canva avec 3 zones :
1. **Toolbar verticale gauche** (icônes) : Prompt, Structure (H1/H2/URL/mots-clés), Images (génération IA multi-styles multi-formats), Données structurées (meta title/description, JSON-LD, robots, canonical), Brouillon (sauvegarde/historique), Bibliothèque (galerie images+pages), Options.
2. **Panneau contextuel** (centre, un seul ouvert à la fois) : champs éditables + zone "Instructions spécifiques" partagée avec bouton "Injecter" en sticky footer. Le panneau est redimensionnable en largeur (260-500px).
3. **Preview/Canvas** (droite, pleine largeur quand aucun panneau ouvert) : rendu de la page en temps réel, édition directe, boutons "Enregistrer" (brouillon) et "Publier vers le CMS" en haut à droite. Un spinner s'affiche pendant chaque rechargement.

**Précision identique partout** : hors /cocoon, Content Architect effectue un pré-appel silencieux au moteur stratégique pour pré-remplir la structure (H1, H2, mots-clés). L'utilisateur bénéficie donc toujours de l'intelligence stratégique.

**Images IA** : génération dans plusieurs styles (photo, cinematic, flat illustration, infographic, watercolor, artistic) et plusieurs formats, adapté au secteur du site.

- **Publication CMS** : Les contenus générés peuvent être publiés directement en brouillon sur le CMS du client (WordPress, Shopify, Drupal, Odoo, PrestaShop, IKtracker, **crawlers.fr en interne**). Supporte la création d'**articles** ET de **pages statiques** selon le CMS.
- **CMS Interne crawlers.fr** : Parménion peut modifier directement les articles et pages de crawlers.fr via la plateforme \`crawlers_internal\` (écriture dans \`blog_articles\` et \`seo_page_drafts\`). Bouton "Parménion (Glaive)" disponible au survol des articles dans le CMS admin pour ajouter une URL au plan de tâches.
- **Limites mensuelles** : 5 contenus/mois (Free), 80 contenus/mois (Pro Agency), 150 contenus/mois (Pro Agency+). Renouvellement automatique le 1er du mois.

**Félix peut aider** : en dehors de /cocoon, Félix peut guider l'utilisateur dans Content Architect (expliquer les panneaux, le workflow, les options). Il peut aussi prendre la main en lançant la génération ou en suggérant des instructions spécifiques à injecter.

## Crédits & Abonnement
- 20 crédits offerts à l'inscription.
- Freemium : bots IA, GEO Score, LLM, PageSpeed gratuits. Audit SEO 1/jour.
- Pro Agency : 29€/mois garanti à vie pour les 100 premiers. 5 000 pages de crawl/mois, 10 pages/scan. Détails sur [la page tarifs](https://crawlers.fr/tarifs).
- Pro Agency + : 79€/mois. 50 000 pages de crawl/mois, 50 pages/scan. Pour les agences et structures avec 10+ clients. Analyse des logs serveur. Détails sur [la page Pro Agency](https://crawlers.fr/pro-agency).

## Analyse des Logs (Pro Agency+)
Accessible via [Console](https://crawlers.fr/console) > Mes sites > API (section Analyse de logs).
- **À quoi ça sert** : L'analyse des logs serveur permet de voir EXACTEMENT quels bots (Googlebot, GPTBot, ClaudeBot, BingBot, PerplexityBot, Ahrefs, etc.) visitent le site de l'utilisateur, à quelle fréquence, quelles pages ils explorent, et avec quel code de réponse HTTP.
- **Pourquoi c'est crucial en SEO** : Les logs sont la seule preuve objective du passage réel des robots. Google Search Console ne montre qu'un échantillon. Les logs montrent 100% des visites de bots, y compris ceux qui sont bloqués ou qui reçoivent des erreurs 404/500.
- **Pourquoi c'est crucial en GEO (Generative Engine Optimization)** : C'est la seule façon de savoir si les bots IA (GPTBot, ClaudeBot, PerplexityBot, Anthropic) visitent réellement le site. Sans logs, on ne peut que deviner. Avec les logs, on sait précisément quels contenus attirent l'attention des LLMs.
- **Sources supportées** : Cloudflare, Vercel, WordPress (plugin), Agent Bash, Upload fichier, WP Engine, Kinsta, SFTP/SSH, AWS S3.
- **Comment Crawlers utilise ces données** : Les données de logs alimentent les graphiques de fréquence de crawl, la détection d'anomalies (baisse soudaine de crawl), et enrichissent le contexte de tous les agents IA (Félix, Stratège Cocoon) pour des recommandations plus précises. Si un bot IA ne crawle pas un site, Crawlers recommande des actions spécifiques (vérifier robots.txt, ajouter du contenu structuré, améliorer la fraîcheur).
- **Prérequis** : abonnement Pro Agency+ actif.
- Packs de crédits ponctuels : Essentiel (10 crédits, 5€), Pro (50 crédits, 19€), Premium (150 crédits, 45€).
- Résiliation : [Console](https://crawlers.fr/console) > Paramètres > Abonnement > Résilier.

## Problèmes fréquents
- Audit bloqué : attendre 5 min, rafraîchir, relancer après 10 min.
- GSC/GA4 non connecté : bon compte Google, tous scopes OAuth, site vérifié dans GSC. Connexion depuis [Console](https://crawlers.fr/console).
- GEO bas : pas de JSON-LD, contenu générique, bots IA bloqués dans robots.txt, pas de page À propos. Utiliser [Code Architect](https://crawlers.fr/architecte-generatif).
- Données GSC absentes : patienter 5-10 min, 28j d'historique minimum.
- Stratégie 360° ne se lance pas : vérifier qu'un crawl a été effectué et que le cocon sémantique est généré.

## Sécurité & RGPD
- Hébergement européen, RGPD natif. Détails : [politique de confidentialité](https://crawlers.fr/politique-confidentialite).
- Tokens OAuth chiffrés, isolation par utilisateur.
- Suppression compte : [Console](https://crawlers.fr/console) > Paramètres, effacement sous 72h.

## Intégration technique
- SDK : snippet JS, déploiement automatique.
- GTM : [guide d'intégration](https://crawlers.fr/integration-gtm).
- WordPress : scanner natif, compatible Elementor/Divi/Astra.
- [Rank Math](https://crawlers.fr/console) : connexion via onglet API dans la Console.

# OBJECTIONS TARIFAIRES
"C'est trop cher" → Pro Agency 29€ remplace Semrush (120€) + Screaming Frog (200€/an) + outils GEO (95-295€). Garanti à vie pour les 100 premiers. Pro Agency+ à 79€ pour les agences avec gros volumes de crawl (50 000 pages/mois).
"Je veux tester" → Freemium : audit SEO 200 pts, GEO Score, Visibilité LLM, PageSpeed — gratuits sans carte bancaire.
"Pourquoi pas Semrush ?" → Semrush = SEO classique. Crawlers.fr ajoute visibilité ChatGPT/Perplexity/Gemini + correctifs actionnables.
"Pro Agency ou Pro Agency+ ?" → Pro Agency (29€) = indépendants et petites agences (1-5 clients). Pro Agency+ (79€) = agences avec 10+ clients, gros volumes de crawl (50k pages/mois vs 5k), analyse des logs serveur, API Marina marque blanche complète.

# ESCALADE
Si demande de remboursement, bug bloquant > 10min, facturation, suppression compte, ou hors périmètre :
"Je transmets votre demande à l'équipe Crawlers.fr. Vous recevrez une réponse sous 24h ouvrées."

# CADRAGE D'INTENTIONNALITÉ (OBLIGATOIRE)
Quand tu cites un score ou une métrique, tu DOIS TOUJOURS suivre ce format en 3 temps :
1. LE CHIFFRE BRUT — la donnée factuelle
2. CE QUE ÇA SIGNIFIE CONCRÈTEMENT — l'impact business/visibilité en langage humain
3. L'ACTION PRIORITAIRE — ce qu'il faut faire pour améliorer la situation

Exemples :
- "GEO à 42/100 — les LLMs citent rarement votre marque. Priorité : enrichir vos pages FAQ avec des données structurées FAQ + HowTo."
- "Score E-E-A-T à 28 — Google ne vous considère pas comme un expert crédible. Action : ajouter une page À propos avec bio détaillée et liens LinkedIn."
- "3 pages orphelines détectées — elles sont invisibles pour Google et les LLMs. Ajoutez un lien depuis votre page pilier vers chacune."

Ne cite JAMAIS un score sans expliquer ce qu'il signifie pour le business et sans donner une action concrète.

# FORMULATIONS STRICTEMENT INTERDITES
Ne commence JAMAIS ta réponse par : "Bien sûr !", "Excellente question !", "Avec plaisir !", "Certainement !", "Bonne question !", "Absolument !", "Merci pour votre question", "C'est une très bonne question".
Ne mentionne JAMAIS : Supabase, Edge Function, Deno, PostgreSQL, Lovable, cocoon-strategist, cocoon-diag-, getDomainContext, DataForSEO, SerpAPI, Spider API, Firecrawl, Browserless.
Ne dis JAMAIS : "on pourrait envisager de", "il serait peut-être pertinent de".`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }
try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid or empty request body" }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    // ── Post-chat route tracking (separate lightweight action) ──
    if (body.action === "track_post_chat") {
      const sb = getServiceClient();
      const { conversation_id: convId, post_chat_route, delay_seconds } = body;
      if (convId && post_chat_route) {
        // Get the suggested route from existing score
        const { data: score } = await sb
          .from("sav_quality_scores")
          .select("id, suggested_route, precision_score")
          .eq("conversation_id", convId)
          .maybeSingle();

        if (score) {
          const routeMatch = score.suggested_route
            ? post_chat_route.startsWith(score.suggested_route) || score.suggested_route.startsWith(post_chat_route)
            : null;

          let updatedScore = score.precision_score;
          if (routeMatch === true) updatedScore = Math.min(100, updatedScore + 30);

          await sb.from("sav_quality_scores").update({
            post_chat_route,
            route_match: routeMatch,
            post_chat_delay_seconds: delay_seconds || null,
            precision_score: updatedScore,
          }).eq("id", score.id);
        }
      }
      return jsonOk({ ok: true });
    }

    const { messages, conversation_id, user_id, guest_mode, screen_context, language: clientLanguage } = body;
    if (!messages || !Array.isArray(messages)) {
      return jsonError("Invalid request", 400);
    }

    const isGuest = guest_mode === true || !user_id;

    const sb = getServiceClient();

    // ── Check if user is admin (creator) ──
    let isCreator = false;
    if (!isGuest && user_id) {
      const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user_id, _role: "admin" });
      isCreator = isAdmin === true;
    }

    // ── Fantomas God Mode ──
    const isFantomasMode = body.fantomas_mode === true && isCreator;

    // ── /createur, /creator, /admin : prefix gate — admin commands require explicit prefix ──
    const lastUserMsgRaw = messages.filter((m: any) => m.role === "user").pop()?.content || "";
    const createurPrefixMatch = lastUserMsgRaw.match(/^\/(?:createur|creator|admin)\s*:\s*/i);
    const isCreatorMode = isCreator && (!!createurPrefixMatch || isFantomasMode);

    // Strip the prefix from the message for downstream processing
    if (createurPrefixMatch) {
      const strippedMsg = lastUserMsgRaw.slice(createurPrefixMatch[0].length).trim();
      const lastUserMsgIndex = messages.map((m: any) => m.role).lastIndexOf("user");
      if (lastUserMsgIndex >= 0) {
        messages[lastUserMsgIndex] = { ...messages[lastUserMsgIndex], content: strippedMsg };
      }
    }

    // ── Fantomas: auto-route to agents via LLM ──
    if (isFantomasMode) {
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      
      try {
        // Use LLM to determine which agents should handle this directive
        const routingPrompt = `Tu es un routeur de directives pour une plateforme SEO/GEO.
L'administrateur créateur envoie une instruction. Tu dois déterminer quel(s) agent(s) doivent la traiter.

Agents disponibles :
- seo : Agent SEO — tout ce qui concerne le contenu SEO, les pages, les balises, le maillage interne, les sitemaps, les canonicals, les redirections, le robots.txt, les pages blog/guides
- cto : Agent CTO — tout ce qui concerne le code, les bugs, les edge functions, les erreurs techniques, la base de données, les performances backend, les scripts
- ux : Agent UX — tout ce qui concerne le design, l'interface utilisateur, les composants React, le CSS, l'accessibilité, le responsive
- supervisor : Supervisor — audits de qualité, vérification des actions des autres agents, monitoring global

Instruction : "${lastUserMsg}"

Réponds UNIQUEMENT en JSON strict :
{
  "agents": ["seo", "cto"],
  "directive_text": "texte nettoyé de la directive",
  "target_url": "/chemin si mentionné ou null",
  "target_function": "nom-function si mentionné ou null",
  "target_component": "composant si mentionné ou null",
  "priority": "critical"
}`;

        const routingResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: routingPrompt }],
            stream: false,
            max_tokens: 300,
          }),
        });

        if (routingResp.ok) {
          const routingData = await routingResp.json();
          logAIUsageFromResponse(sb, "google/gemini-2.5-flash-lite", "sav-agent", routingData.usage);
          const routingText = routingData.choices?.[0]?.message?.content || "";
          const jsonMatch = routingText.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            const routing = JSON.parse(jsonMatch[0]);
            const agents: string[] = routing.agents || ["cto"];
            const directiveText = routing.directive_text || lastUserMsg;
            const targetUrl = routing.target_url || null;
            const targetFunction = routing.target_function || null;
            const targetComponent = routing.target_component || null;

            const dispatched: string[] = [];

            // Insert directives in parallel for all targeted agents
            const insertPromises = agents.map(async (agent: string) => {
              try {
                switch (agent) {
                  case 'seo': {
                    const targetSlug = targetUrl ? targetUrl.replace(/^\/blog\//, '').replace(/^\//, '').replace(/\/$/, '') : null;
                    await sb.from("agent_seo_directives").insert({
                      user_id, directive_text: directiveText, target_url: targetUrl, target_slug: targetSlug, status: 'pending',
                    });
                    dispatched.push('🔍 Agent SEO');
                    break;
                  }
                  case 'cto': {
                    await sb.from("agent_cto_directives").insert({
                      user_id, directive_text: directiveText, target_function: targetFunction, target_url: targetUrl, status: 'pending',
                    });
                    dispatched.push('🔧 Agent CTO');
                    break;
                  }
                  case 'ux': {
                    await sb.from("agent_ux_directives").insert({
                      user_id, directive_text: directiveText, target_component: targetComponent, target_url: targetUrl, status: 'pending',
                    });
                    dispatched.push('🎨 Agent UX');
                    break;
                  }
                  case 'supervisor': {
                    await sb.from("agent_supervisor_directives").insert({
                      user_id, directive_text: directiveText, target_function: targetFunction, target_url: targetUrl, status: 'pending',
                    });
                    dispatched.push('🛡️ Supervisor');
                    break;
                  }
                }
              } catch (e) {
                console.error(`[fantomas] Error inserting ${agent} directive:`, e);
              }
            });

            await Promise.all(insertPromises);

            // Fire dispatch immediately
            fireDispatchAgentDirectives();

            const confirmReply = `⚡ **Fantomas — Dispatch critique**\n\n> ${directiveText}\n\n**Agents ciblés :**\n${dispatched.join('\n')}\n\n${targetUrl ? `📍 Cible : \`${targetUrl}\`\n` : ''}${targetFunction ? `⚙️ Fonction : \`${targetFunction}\`\n` : ''}${targetComponent ? `🧩 Composant : \`${targetComponent}\`\n` : ''}\n✅ Directives créées avec priorité **critique**. Dispatch immédiat lancé.`;

            // Save conversation
            let savedConvId = conversation_id;
            try {
              const allMessages = [...messages, { role: "assistant", content: confirmReply }];
              if (conversation_id) {
                await sb.from("sav_conversations").update({ messages: allMessages, message_count: allMessages.length }).eq("id", conversation_id);
              } else {
                const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();
                const { data: newConv } = await sb.from("sav_conversations").insert({
                  user_id, user_email: prof?.email || null, messages: allMessages, message_count: allMessages.length,
                }).select("id").single();
                savedConvId = newConv?.id;
              }
            } catch (e) {
              console.error("Save fantomas conv error:", e);
            }

            return jsonOk({ reply: confirmReply, conversation_id: savedConvId || conversation_id });
          }
        }
      } catch (e) {
        console.error("[fantomas] Routing error:", e);
        // Fall through to normal creator mode flow
      }
    }

    // ── Load Felix config from DB ──
    let felixConfig: Record<string, string> = {};
    try {
      const { data: cfgRows } = await sb.from("felix_config").select("config_key, config_value");
      if (cfgRows) {
        for (const row of cfgRows) felixConfig[row.config_key] = row.config_value;
      }
    } catch (_) { /* non-blocking */ }

    // ── Detect backend query intent from creator ──
    if (isCreatorMode) {
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      const lowerMsgCheck = lastUserMsg.toLowerCase();
      
      // ── Felix self-configuration detection ──
      const felixConfigKeywords = ['ton', 'tone', 'longueur', 'verbosité', 'max_tokens', 'modèle', 'model', 'cta', 'vouvoiement', 'tutoiement', 'emojis', 'emoji', 'greeting', 'salutation', 'proactif', 'proactive', 'confidentialité', 'niveau', 'level', 'paramètre', 'config'];
      const isFelixConfigIntent = felixConfigKeywords.some(kw => lowerMsgCheck.includes(kw)) && 
        (/(?:change|mets|passe|configure|règle|ajuste|définis|set|switch|active|désactive|augmente|réduis|coupe)/i.test(lastUserMsg));
      
      if (isFelixConfigIntent) {
        try {
          // Use LLM to extract config changes from natural language
          const configExtractionPrompt = `Tu es un parseur de configuration. L'utilisateur creator veut modifier les paramètres de Félix.

Paramètres disponibles et valeurs possibles :
- tone: collegial | formel | decontracte | technique
- max_tokens: nombre (200-3000)
- max_tokens_creator: nombre (500-5000)
- vouvoiement: auto | toujours | jamais
- emojis: mirror | always | never
- cta_style: subtle | direct | none
- greeting_style: skip | warm
- user_level_detection: true | false
- proactive_suggestions: true | false
- model: google/gemini-2.5-flash | google/gemini-2.5-pro | openai/gpt-5-mini | openai/gpt-5
- confidentiality_strict: true | false

Valeurs actuelles :
${Object.entries(felixConfig).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Message du creator : "${lastUserMsg}"

Réponds UNIQUEMENT en JSON : { "changes": [{"key": "...", "value": "..."}], "summary": "résumé en français des changements" }
Si aucun changement détecté, retourne : { "changes": [], "summary": "Aucun changement détecté" }`;

          const configResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [{ role: "user", content: configExtractionPrompt }],
              stream: false,
              max_tokens: 300,
            }),
          });

          if (configResp.ok) {
            const configData = await configResp.json();
            const configText = configData.choices?.[0]?.message?.content || "";
            const jsonMatch = configText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.changes?.length > 0) {
                const appliedChanges: string[] = [];
                for (const change of parsed.changes) {
                  const { error } = await sb.from("felix_config")
                    .update({ config_value: String(change.value), updated_by: user_id })
                    .eq("config_key", change.key);
                  if (!error) {
                    felixConfig[change.key] = String(change.value);
                    appliedChanges.push(`**${change.key}** → \`${change.value}\``);
                  }
                }
                if (appliedChanges.length > 0) {
                  const configReply = `✅ Configuration mise à jour :\n${appliedChanges.join('\n')}\n\n${parsed.summary || 'Changements appliqués immédiatement.'}`;
                  return jsonOk({ reply: configReply, conversation_id: conversation_id, felix_config_updated: true });
                }
              }
            }
          }
        } catch (e) {
          console.warn("[sav-agent] Felix config update error:", e);
          // Fall through to normal processing
        }
      }

      // ── Parménion intent detection ──
      const parmenionKeywords = [
        "parménion", "parmenion", "autopilot", "autopilote",
        "que fait-il", "qu'est-ce qu'il fait", "qu'a-t-il fait",
        "cycle en cours", "dernier cycle", "prochain cycle",
        "diagnostic autopilot", "observations autopilot",
      ];
      const isParmenionQuestion = parmenionKeywords.some(kw => lowerMsgCheck.includes(kw));
      
      if (isParmenionQuestion) {
        // Fetch Parménion context and let Felix narrate it
        try {
          const authHeader = req.headers.get("Authorization") || "";
          
          // Fetch latest decision logs, autopilot configs, and modification logs in parallel
          const [decisionsResp, configsResp, modsResp] = await Promise.all([
            sb.from("parmenion_decision_log")
              .select("cycle_number, goal_type, goal_description, action_type, status, impact_level, risk_predicted, risk_calibrated, is_error, error_category, calibration_note, impact_predicted, impact_actual, estimated_tokens, functions_called, scope_reductions, goal_changed, execution_error, created_at, domain, final_scope")
              .order("created_at", { ascending: false })
              .limit(10),
            sb.from("autopilot_configs")
              .select("tracked_site_id, is_active, status, last_cycle_at, total_cycles_run, max_pages_per_cycle, cooldown_hours, auto_pause_threshold, implementation_mode, diag_audit_complet, diag_crawl, diag_stratege_cocoon, presc_architect, presc_content_architect, presc_stratege_cocoon, excluded_subdomains, excluded_page_types")
              .limit(10),
            sb.from("autopilot_modification_log")
              .select("action_type, phase, description, page_url, status, cycle_number, created_at, domain")
              .order("created_at", { ascending: false })
              .limit(15),
          ]);

          // Also get error rate
          const domains = [...new Set((decisionsResp.data || []).map((d: any) => d.domain))];
          let errorRates: Record<string, any> = {};
          for (const domain of domains.slice(0, 3)) {
            const { data: rate } = await sb.rpc("parmenion_error_rate", { p_domain: domain });
            if (rate) errorRates[domain] = rate;
          }

          // Build Parménion narrative context
          let parmenionContext = "\n\n# ÉTAT DE PARMÉNION (AUTOPILOTE)\n";
          
          // Configs
          if (configsResp.data?.length) {
            parmenionContext += "\n## Configurations actives\n";
            for (const cfg of configsResp.data) {
              parmenionContext += `- Site ${cfg.tracked_site_id}: ${cfg.is_active ? '🟢 ACTIF' : '⏸️ EN PAUSE'} | Mode: ${cfg.implementation_mode} | ${cfg.total_cycles_run || 0} cycles exécutés | Dernier: ${cfg.last_cycle_at?.slice(0, 16) || 'jamais'} | Cooldown: ${cfg.cooldown_hours}h | Seuil pause auto: -${cfg.auto_pause_threshold}%\n`;
              parmenionContext += `  Phases diag: ${[cfg.diag_audit_complet && 'audit', cfg.diag_crawl && 'crawl', cfg.diag_stratege_cocoon && 'stratège'].filter(Boolean).join(', ') || 'aucune'} | Phases presc: ${[cfg.presc_architect && 'architect', cfg.presc_content_architect && 'content', cfg.presc_stratege_cocoon && 'stratège'].filter(Boolean).join(', ') || 'aucune'}\n`;
            }
          }

          // Decision logs
          if (decisionsResp.data?.length) {
            parmenionContext += "\n## Dernières décisions (du plus récent au plus ancien)\n";
            for (const d of decisionsResp.data) {
              parmenionContext += `\n### Cycle ${d.cycle_number} — ${d.domain} (${d.created_at?.slice(0, 16)})\n`;
              parmenionContext += `- **But**: ${d.goal_type} — ${d.goal_description}\n`;
              parmenionContext += `- **Action**: ${d.action_type} | Statut: ${d.status} | Impact: ${d.impact_level}\n`;
              parmenionContext += `- **Risque**: prédit=${d.risk_predicted}${d.risk_calibrated ? `, calibré=${d.risk_calibrated}` : ''} | Réductions scope: ${d.scope_reductions} | But changé: ${d.goal_changed ? 'oui' : 'non'}\n`;
              if (d.impact_predicted) parmenionContext += `- **Impact prédit**: ${d.impact_predicted}\n`;
              if (d.impact_actual) parmenionContext += `- **Impact réel**: ${d.impact_actual}\n`;
              if (d.is_error) parmenionContext += `- ⚠️ **ERREUR**: ${d.error_category || 'non catégorisée'}${d.calibration_note ? ` — ${d.calibration_note}` : ''}\n`;
              if (d.execution_error) parmenionContext += `- ❌ **Erreur d'exécution**: ${d.execution_error}\n`;
              if (d.functions_called?.length) parmenionContext += `- Fonctions appelées: ${d.functions_called.join(', ')}\n`;
              if (d.estimated_tokens) parmenionContext += `- Tokens estimés: ${d.estimated_tokens.toLocaleString()}\n`;
            }
          }

          // Modification log
          if (modsResp.data?.length) {
            parmenionContext += "\n## Dernières modifications appliquées\n";
            for (const m of modsResp.data) {
              parmenionContext += `- [${m.created_at?.slice(0, 16)}] ${m.domain} — Phase: ${m.phase} | Action: ${m.action_type} | ${m.description || ''} ${m.page_url ? `(${m.page_url})` : ''} → ${m.status}\n`;
            }
          }

          // Error rates
          if (Object.keys(errorRates).length) {
            parmenionContext += "\n## Taux d'erreur\n";
            for (const [domain, rate] of Object.entries(errorRates)) {
              const r = rate as any;
              parmenionContext += `- ${domain}: ${r.error_rate}% d'erreur (${r.errors}/${r.total}) ${r.conservative_mode ? '⚠️ MODE CONSERVATEUR ACTIF' : ''}\n`;
            }
          }

          // Narrative instructions
          parmenionContext += `\n## INSTRUCTIONS DE NARRATION
Tu dois traduire ces données techniques en langage clair et naturel pour le créateur :
- Décris ce que Parménion fait EN CE MOMENT (dernier cycle avec statut 'pending' ou 'in_progress')
- Résume ce qu'il a fait AVANT (derniers cycles complétés, succès/échecs, impact)
- Déduis ce qu'il COMPTE FAIRE ensuite (en fonction du goal_type, du pattern de décisions, du cooldown restant, et des phases activées)
- Traduis les observations : "scope_reductions=2" → "il a réduit son périmètre 2 fois pour rester prudent"
- Traduis les diagnostics : "risk_predicted=4, goal_changed=true" → "il a jugé l'action trop risquée et a changé de stratégie"
- Si mode conservateur actif, explique pourquoi (trop d'erreurs récentes)
- Utilise un ton narratif engageant, comme si tu racontais les décisions d'un général de terrain
- Tu peux nommer Parménion directement ("Parménion a décidé de...")
- Pas de limite de caractères pour ces réponses narratives (max 3000)`;

          // Build the prompt and call LLM directly with this rich context
          const narrativePrompt = SYSTEM_PROMPT + parmenionContext + `\n\n# MODE CRÉATEUR (ADMIN)\nCet utilisateur est le créateur de la plateforme. Tu peux parler librement de l'architecture et des données internes.`;
          
          const aiMessages = [
            { role: "system", content: narrativePrompt },
            ...messages.slice(-20),
          ];

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: aiMessages,
              stream: false,
              max_tokens: 2500,
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            logAIUsageFromResponse(sb, "google/gemini-2.5-flash", "sav-agent", aiData.usage);
            let reply = aiData.choices?.[0]?.message?.content || "Je n'ai pas pu récupérer l'état de Parménion.";
            if (reply.length > 3000) reply = reply.substring(0, 2997) + "...";

            // Save conversation
            let savedConvId = conversation_id;
            try {
              const allMessages = [...messages, { role: "assistant", content: reply }];
              if (conversation_id) {
                await sb.from("sav_conversations").update({
                  messages: allMessages,
                  message_count: allMessages.length,
                }).eq("id", conversation_id);
              } else {
                const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();
                const { data: newConv } = await sb.from("sav_conversations").insert({
                  user_id,
                  user_email: prof?.email || null,
                  messages: allMessages,
                  message_count: allMessages.length,
                }).select("id").single();
                savedConvId = newConv?.id;
              }
            } catch (e) {
              console.error("Save parmenion conv error:", e);
            }

            return jsonOk({ reply, conversation_id: savedConvId || conversation_id });
          }
        } catch (e) {
          console.error("Parmenion context fetch error:", e);
          // Fall through to normal flow
        }
      }

      // ── Agent status QUERY detection (admin creator only) ──
      // Detects questions ABOUT agents (status, consumed directives, proposals, last run...)
      const agentQueryKeywords = [
        "agent cto a-t-il", "agent cto a t il", "agent cto a-t'il",
        "agent seo a-t-il", "agent seo a t il", "agent seo a-t'il",
        "supervisor a-t-il", "supervisor a t il", "supervisor a-t'il",
        "directives transmises", "directives envoyées", "directives pending",
        "directives en attente", "directives consommées",
        "état des directives", "statut des directives", "status directives",
        "état de l'agent", "statut de l'agent", "status agent",
        "dernier cycle", "dernière exécution", "last run",
        "propositions de code", "code proposals", "proposals en attente",
        "qu'a fait l'agent", "qu'a fait agent", "que fait l'agent",
        "rapport agent", "rapport du supervisor", "rapport supervisor",
        "activité agent", "activité des agents", "activité cto", "activité seo",
        "a-t-il regardé", "a t il regardé", "a-t-il traité", "a t il traité",
        "a-t-il consommé", "a t il consommé",
        "combien de directives", "combien de proposals",
        "historique agent", "historique directives",
        // Query-intent phrases (list, show, give me, status...)
        "liste des dernières actions", "dernières actions de",
        "dernières actions agent", "liste des actions",
        "actions de l'agent", "actions agent cto", "actions agent seo",
        "montre les actions", "montre-moi les actions",
        "donne moi la liste", "donne-moi la liste",
        "résumé des agents", "résumé agent", "summary agent",
        "état des agents", "statut des agents", "status des agents",
        "qu'ont fait les agents", "qu'ont fait agent",
        "actions des agents", "derniers résultats agent",
        "bilan agent", "bilan des agents", "bilan cto", "bilan seo", "bilan ux",
        "agent ux a-t-il", "agent ux a t il", "activité ux", "actions agent ux",
      ];
      const isAgentQuery = isCreator && agentQueryKeywords.some(kw => lowerMsgCheck.includes(kw));

      if (isAgentQuery) {
        try {
          // Determine which agent(s) the question is about
          const aboutCto = lowerMsgCheck.includes("cto");
          const aboutSeo = lowerMsgCheck.includes("seo");
          const aboutUx = lowerMsgCheck.includes("ux") || lowerMsgCheck.includes("design");
          const aboutSupervisor = lowerMsgCheck.includes("supervisor");
          const aboutAll = (!aboutCto && !aboutSeo && !aboutSupervisor && !aboutUx) || lowerMsgCheck.includes("tous les agents") || lowerMsgCheck.includes("all agents");

          let agentReport = "📋 **Rapport d'état des agents**\n\n";

          // Query CTO directives
          if (aboutCto || aboutAll) {
            const { data: ctoDirectives } = await sb.from("agent_cto_directives")
              .select("id, directive_text, status, created_at, consumed_at, target_function, target_url")
              .eq("user_id", user_id)
              .order("created_at", { ascending: false })
              .limit(10);

            agentReport += "### 🔧 Agent CTO\n";
            if (ctoDirectives && ctoDirectives.length > 0) {
              const pending = ctoDirectives.filter(d => d.status === 'pending');
              const consumed = ctoDirectives.filter(d => d.status === 'consumed' || d.consumed_at);
              agentReport += `- **${pending.length}** directive(s) en attente\n`;
              agentReport += `- **${consumed.length}** directive(s) consommée(s)\n`;
              agentReport += `- Dernière directive : ${new Date(ctoDirectives[0].created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n`;
              if (ctoDirectives[0].consumed_at) {
                agentReport += `- Dernière consommation : ${new Date(ctoDirectives[0].consumed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n`;
              }
              agentReport += "\n**Dernières directives :**\n";
              for (const d of ctoDirectives.slice(0, 5)) {
                const statusIcon = d.consumed_at ? "✅" : "⏳";
                agentReport += `${statusIcon} _${new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}_ — ${d.directive_text.slice(0, 80)}${d.directive_text.length > 80 ? '...' : ''}\n`;
              }
            } else {
              agentReport += "Aucune directive transmise.\n";
            }

            // CTO proposals
            const { data: ctoProposals, count: proposalCount } = await sb.from("cto_code_proposals")
              .select("id, title, status, created_at, agent_source", { count: "exact" })
              .eq("agent_source", "cto")
              .order("created_at", { ascending: false })
              .limit(5);
            if (ctoProposals && ctoProposals.length > 0) {
              const pendingP = ctoProposals.filter(p => p.status === 'pending');
              agentReport += `\n**Propositions de code :** ${proposalCount} total, ${pendingP.length} en attente\n`;
              for (const p of ctoProposals.slice(0, 3)) {
                const icon = p.status === 'approved' ? '✅' : p.status === 'rejected' ? '❌' : '⏳';
                agentReport += `${icon} ${p.title?.slice(0, 60) || 'Sans titre'} (${p.status})\n`;
              }
            }
            agentReport += "\n";
          }

          // Query SEO directives
          if (aboutSeo || aboutAll) {
            const { data: seoDirectives } = await sb.from("agent_seo_directives")
              .select("id, directive_text, status, created_at, consumed_at, target_url, target_slug")
              .eq("user_id", user_id)
              .order("created_at", { ascending: false })
              .limit(10);

            agentReport += "### 🔍 Agent SEO\n";
            if (seoDirectives && seoDirectives.length > 0) {
              const pending = seoDirectives.filter(d => d.status === 'pending');
              const consumed = seoDirectives.filter(d => d.status === 'consumed' || d.consumed_at);
              agentReport += `- **${pending.length}** directive(s) en attente\n`;
              agentReport += `- **${consumed.length}** directive(s) consommée(s)\n`;
              agentReport += `- Dernière directive : ${new Date(seoDirectives[0].created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n`;
              if (seoDirectives[0].consumed_at) {
                agentReport += `- Dernière consommation : ${new Date(seoDirectives[0].consumed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n`;
              }
              agentReport += "\n**Dernières directives :**\n";
              for (const d of seoDirectives.slice(0, 5)) {
                const statusIcon = d.consumed_at ? "✅" : "⏳";
                agentReport += `${statusIcon} _${new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}_ — ${d.directive_text.slice(0, 80)}${d.directive_text.length > 80 ? '...' : ''}\n`;
              }

              // SEO proposals
              const { data: seoProposals, count: seoProposalCount } = await sb.from("cto_code_proposals")
                .select("id, title, status, created_at, agent_source", { count: "exact" })
                .eq("agent_source", "seo")
                .order("created_at", { ascending: false })
                .limit(5);
              if (seoProposals && seoProposals.length > 0) {
                const pendingP = seoProposals.filter(p => p.status === 'pending');
                agentReport += `\n**Propositions SEO :** ${seoProposalCount} total, ${pendingP.length} en attente\n`;
                for (const p of seoProposals.slice(0, 3)) {
                  const icon = p.status === 'approved' ? '✅' : p.status === 'rejected' ? '❌' : '⏳';
                  agentReport += `${icon} ${p.title?.slice(0, 60) || 'Sans titre'} (${p.status})\n`;
                }
              }
            } else {
              agentReport += "Aucune directive transmise.\n";
            }
            agentReport += "\n";
          }

          // Query Supervisor directives
          if (aboutSupervisor || aboutAll) {
            const { data: supDirectives } = await sb.from("agent_supervisor_directives")
              .select("id, directive_text, status, created_at, consumed_at, target_function, target_url")
              .eq("user_id", user_id)
              .order("created_at", { ascending: false })
              .limit(10);

            agentReport += "### 🛡️ Supervisor\n";
            if (supDirectives && supDirectives.length > 0) {
              const pending = supDirectives.filter(d => d.status === 'pending');
              const consumed = supDirectives.filter(d => d.status === 'consumed' || d.consumed_at);
              agentReport += `- **${pending.length}** directive(s) en attente\n`;
              agentReport += `- **${consumed.length}** directive(s) consommée(s)\n`;
              agentReport += `- Dernière directive : ${new Date(supDirectives[0].created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n`;
              if (supDirectives[0].consumed_at) {
                agentReport += `- Dernière consommation : ${new Date(supDirectives[0].consumed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n`;
              }
              agentReport += "\n**Dernières directives :**\n";
              for (const d of supDirectives.slice(0, 5)) {
                const statusIcon = d.consumed_at ? "✅" : "⏳";
                agentReport += `${statusIcon} _${new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}_ — ${d.directive_text.slice(0, 80)}${d.directive_text.length > 80 ? '...' : ''}\n`;
              }

              // Supervisor cycles
              const { data: supCycles } = await sb.from("supervisor_cycles")
                .select("id, status, started_at, completed_at, functions_audited, error_count, correction_count")
                .order("started_at", { ascending: false })
                .limit(3);
              if (supCycles && supCycles.length > 0) {
                agentReport += `\n**Derniers cycles Supervisor :**\n`;
                for (const c of supCycles) {
                  const statusIcon = c.status === 'completed' ? '✅' : c.status === 'failed' ? '❌' : '🔄';
                  const date = new Date(c.started_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                  agentReport += `${statusIcon} ${date} — ${c.functions_audited || 0} fonctions, ${c.correction_count || 0} corrections, ${c.error_count || 0} erreurs\n`;
                }
              }
            } else {
              agentReport += "Aucune directive transmise.\n";
            }
            agentReport += "\n";
          }

          // Query UX directives
          if (aboutUx || aboutAll) {
            const { data: uxDirectives } = await sb.from("agent_ux_directives")
              .select("id, directive_text, status, created_at, consumed_at, target_component, target_url")
              .eq("user_id", user_id)
              .order("created_at", { ascending: false })
              .limit(10);

            agentReport += "### 🎨 Agent UX\n";
            if (uxDirectives && uxDirectives.length > 0) {
              const pending = uxDirectives.filter(d => d.status === 'pending');
              const consumed = uxDirectives.filter(d => d.status === 'consumed' || d.consumed_at);
              agentReport += `- **${pending.length}** directive(s) en attente\n`;
              agentReport += `- **${consumed.length}** directive(s) consommée(s)\n`;
              agentReport += `- Dernière directive : ${new Date(uxDirectives[0].created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n`;
              agentReport += "\n**Dernières directives :**\n";
              for (const d of uxDirectives.slice(0, 5)) {
                const statusIcon = d.consumed_at ? "✅" : "⏳";
                agentReport += `${statusIcon} _${new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}_ — ${d.directive_text.slice(0, 80)}${d.directive_text.length > 80 ? '...' : ''}\n`;
              }

              // UX proposals
              const { data: uxProposals, count: uxProposalCount } = await sb.from("cto_code_proposals")
                .select("id, title, status, created_at, agent_source", { count: "exact" })
                .eq("agent_source", "ux")
                .order("created_at", { ascending: false })
                .limit(5);
              if (uxProposals && uxProposals.length > 0) {
                const pendingP = uxProposals.filter(p => p.status === 'pending');
                agentReport += `\n**Propositions UX :** ${uxProposalCount} total, ${pendingP.length} en attente\n`;
                for (const p of uxProposals.slice(0, 3)) {
                  const icon = p.status === 'approved' ? '✅' : p.status === 'rejected' ? '❌' : '⏳';
                  agentReport += `${icon} ${p.title?.slice(0, 60) || 'Sans titre'} (${p.status})\n`;
                }
              }
            } else {
              agentReport += "Aucune directive transmise.\n";
            }
            agentReport += "\n";
          }

          if (agentReport.length > 3000) agentReport = agentReport.substring(0, 2997) + "...";

          // Save conversation
          let savedConvId = conversation_id;
          try {
            const allMessages = [...messages, { role: "assistant", content: agentReport }];
            if (conversation_id) {
              await sb.from("sav_conversations").update({ messages: allMessages, message_count: allMessages.length }).eq("id", conversation_id);
            } else {
              const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();
              const { data: newConv } = await sb.from("sav_conversations").insert({
                user_id, user_email: prof?.email || null, messages: allMessages, message_count: allMessages.length,
              }).select("id").single();
              savedConvId = newConv?.id;
            }
          } catch (e) {
            console.error("Save agent query conv error:", e);
          }

          return jsonOk({ reply: agentReport, conversation_id: savedConvId || conversation_id });
        } catch (e) {
          console.error("Agent status query error:", e);
          // Fall through to normal flow
        }
      }

      // ── SEO Agent directive detection (admin creator only) ──
      const seoDirectiveMatch = lastUserMsg.match(/^\/seo\s+(.+)/is);
      const seoNaturalKeywords = [
        "agent seo", "dis à l'agent seo", "dis a l'agent seo",
        "demande à l'agent seo", "demande a l'agent seo",
        "instruction seo", "directive seo",
        "l'agent seo doit", "agent seo doit",
      ];
      const isSeoDirective = seoDirectiveMatch || seoNaturalKeywords.some(kw => lowerMsgCheck.includes(kw));

      if (isSeoDirective && !isCreator) {
        return jsonOk({ reply: "⚠️ Seul l'administrateur créateur peut transmettre des directives à l'Agent SEO.", conversation_id });
      }

      if (isSeoDirective && isCreator) {
        // Check if Felix→SEO bridge is enabled
        const { data: bridgeConf } = await sb.from("admin_dashboard_config").select("card_order").eq("user_id", user_id).maybeSingle();
        const bridgeConfig = (bridgeConf?.card_order as any) || {};
        if (bridgeConfig.felix_seo_bridge === false) {
          return jsonOk({ reply: "⚠️ Le pont Félix → Agent SEO est actuellement **désactivé**. Vous pouvez le réactiver depuis le Hub Intelligence (admin).", conversation_id });
        }
        try {
          const directiveText = seoDirectiveMatch
            ? seoDirectiveMatch[1].trim()
            : lastUserMsg;

          // Extract target URL/slug if mentioned
          const urlMatch = directiveText.match(/(?:sur|pour|page|url)\s+(\/[^\s,]+|https?:\/\/[^\s,]+)/i);
          const targetUrl = urlMatch ? urlMatch[1] : null;
          const targetSlug = targetUrl ? targetUrl.replace(/^\/blog\//, '').replace(/^\//, '').replace(/\/$/, '') : null;

          await sb.from("agent_seo_directives").insert({
            user_id,
            directive_text: directiveText,
            target_url: targetUrl,
            target_slug: targetSlug,
            status: 'pending',
          });

          fireDispatchAgentDirectives();

          const confirmReply = `✅ Directive transmise à l'Agent SEO :\n\n> ${directiveText}\n\n${targetUrl ? `Cible : \`${targetUrl}\`\n` : ''}L'Agent SEO sera déclenché immédiatement.`;

          // Save conversation
          let savedConvId = conversation_id;
          try {
            const allMessages = [...messages, { role: "assistant", content: confirmReply }];
            if (conversation_id) {
              await sb.from("sav_conversations").update({
                messages: allMessages,
                message_count: allMessages.length,
              }).eq("id", conversation_id);
            } else {
              const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();
              const { data: newConv } = await sb.from("sav_conversations").insert({
                user_id,
                user_email: prof?.email || null,
                messages: allMessages,
                message_count: allMessages.length,
              }).select("id").single();
              savedConvId = newConv?.id;
            }
          } catch (e) {
            console.error("Save SEO directive conv error:", e);
          }

          return jsonOk({ reply: confirmReply, conversation_id: savedConvId || conversation_id });
        } catch (e) {
          console.error("SEO directive error:", e);
          // Fall through to normal flow
        }
      }

      // ── CTO Agent directive detection (admin creator only) ──
      const ctoDirectiveMatch = lastUserMsg.match(/^\/cto\s+(.+)/is);
      const ctoNaturalKeywords = [
        "agent cto", "dis à l'agent cto", "dis a l'agent cto",
        "demande à l'agent cto", "demande a l'agent cto",
        "instruction cto", "directive cto",
        "l'agent cto doit", "agent cto doit",
      ];
      const isCtoDirective = ctoDirectiveMatch || ctoNaturalKeywords.some(kw => lowerMsgCheck.includes(kw));

      if (isCtoDirective && !isCreator) {
        return jsonOk({ reply: "⚠️ Seul l'administrateur créateur peut transmettre des directives à l'Agent CTO.", conversation_id });
      }

      if (isCtoDirective && isCreator) {
        // Check if Felix→CTO bridge is enabled
        const { data: bridgeConf2 } = await sb.from("admin_dashboard_config").select("card_order").eq("user_id", user_id).maybeSingle();
        const bridgeConfig2 = (bridgeConf2?.card_order as any) || {};
        if (bridgeConfig2.felix_cto_bridge === false) {
          return jsonOk({ reply: "⚠️ Le pont Félix → Agent CTO est actuellement **désactivé**. Vous pouvez le réactiver depuis le Hub Intelligence (admin).", conversation_id });
        }
        try {
          const directiveText = ctoDirectiveMatch
            ? ctoDirectiveMatch[1].trim()
            : lastUserMsg;

          // Extract target function if mentioned
          const funcMatch = directiveText.match(/(?:fonction|function|edge function)\s+([a-z0-9_-]+)/i);
          const targetFunction = funcMatch ? funcMatch[1] : null;
          const urlMatch = directiveText.match(/(?:sur|pour|page|url)\s+(\/[^\s,]+|https?:\/\/[^\s,]+)/i);
          const targetUrl = urlMatch ? urlMatch[1] : null;

          await sb.from("agent_cto_directives").insert({
            user_id,
            directive_text: directiveText,
            target_function: targetFunction,
            target_url: targetUrl,
            status: 'pending',
          });

          fireDispatchAgentDirectives();

          const confirmReply = `✅ Directive transmise à l'Agent CTO :\n\n> ${directiveText}\n\n${targetFunction ? `Fonction cible : \`${targetFunction}\`\n` : ''}${targetUrl ? `URL cible : \`${targetUrl}\`\n` : ''}L'Agent CTO sera déclenché immédiatement.`;

          // Save conversation
          let savedConvId = conversation_id;
          try {
            const allMessages = [...messages, { role: "assistant", content: confirmReply }];
            if (conversation_id) {
              await sb.from("sav_conversations").update({
                messages: allMessages,
                message_count: allMessages.length,
              }).eq("id", conversation_id);
            } else {
              const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();
              const { data: newConv } = await sb.from("sav_conversations").insert({
                user_id,
                user_email: prof?.email || null,
                messages: allMessages,
                message_count: allMessages.length,
              }).select("id").single();
              savedConvId = newConv?.id;
            }
          } catch (e) {
            console.error("Save CTO directive conv error:", e);
          }

          return jsonOk({ reply: confirmReply, conversation_id: savedConvId || conversation_id });
        } catch (e) {
          console.error("CTO directive error:", e);
        }
      }

      // ── Supervisor Agent directive detection (admin creator only) ──
      const supervisorDirectiveMatch = lastUserMsg.match(/^\/supervisor\s+(.+)/is);
      const supervisorNaturalKeywords = [
        "agent supervisor", "dis au supervisor", "dis à supervisor",
        "demande au supervisor", "demande à supervisor",
        "instruction supervisor", "directive supervisor",
        "le supervisor doit", "supervisor doit",
      ];
      const isSupervisorDirective = supervisorDirectiveMatch || supervisorNaturalKeywords.some(kw => lowerMsgCheck.includes(kw));

      if (isSupervisorDirective && !isCreator) {
        return jsonOk({ reply: "⚠️ Seul l'administrateur créateur peut transmettre des directives au Supervisor.", conversation_id });
      }

      if (isSupervisorDirective && isCreator) {
        const { data: bridgeConf3 } = await sb.from("admin_dashboard_config").select("card_order").eq("user_id", user_id).maybeSingle();
        const bridgeConfig3 = (bridgeConf3?.card_order as any) || {};
        if (bridgeConfig3.felix_supervisor_bridge === false) {
          return jsonOk({ reply: "⚠️ Le pont Félix → Supervisor est actuellement **désactivé**. Vous pouvez le réactiver depuis le Hub Intelligence (admin).", conversation_id });
        }
        try {
          const directiveText = supervisorDirectiveMatch
            ? supervisorDirectiveMatch[1].trim()
            : lastUserMsg;

          const funcMatch = directiveText.match(/(?:fonction|function|edge function)\s+([a-z0-9_-]+)/i);
          const targetFunction = funcMatch ? funcMatch[1] : null;
          const urlMatch = directiveText.match(/(?:sur|pour|page|url)\s+(\/[^\s,]+|https?:\/\/[^\s,]+)/i);
          const targetUrl = urlMatch ? urlMatch[1] : null;

          await sb.from("agent_supervisor_directives").insert({
            user_id,
            directive_text: directiveText,
            target_function: targetFunction,
            target_url: targetUrl,
            status: 'pending',
          });

          fireDispatchAgentDirectives();

          const confirmReply = `✅ Directive transmise au Supervisor :\n\n> ${directiveText}\n\n${targetFunction ? `Fonction cible : \`${targetFunction}\`\n` : ''}${targetUrl ? `URL cible : \`${targetUrl}\`\n` : ''}Le Supervisor sera déclenché immédiatement.`;

          let savedConvId = conversation_id;
          try {
            const allMessages = [...messages, { role: "assistant", content: confirmReply }];
            if (conversation_id) {
              await sb.from("sav_conversations").update({
                messages: allMessages,
                message_count: allMessages.length,
              }).eq("id", conversation_id);
            } else {
              const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();
              const { data: newConv } = await sb.from("sav_conversations").insert({
                user_id,
                user_email: prof?.email || null,
                messages: allMessages,
                message_count: allMessages.length,
              }).select("id").single();
              savedConvId = newConv?.id;
            }
          } catch (e) {
            console.error("Save Supervisor directive conv error:", e);
          }

          return jsonOk({ reply: confirmReply, conversation_id: savedConvId || conversation_id });
        } catch (e) {
          console.error("Supervisor directive error:", e);
        }
      }

      // ── UX Agent directive detection (admin creator only) ──
      const uxDirectiveMatch = lastUserMsg.match(/^\/ux\s+(.+)/is);
      const uxNaturalKeywords = [
        "agent ux", "dis à l'agent ux", "dis a l'agent ux",
        "demande à l'agent ux", "demande a l'agent ux",
        "instruction ux", "directive ux", "directive design",
        "l'agent ux doit", "agent ux doit",
        "refonte", "redesign", "nouveau composant",
        "améliore le design", "améliore l'ux", "optimise la conversion",
      ];
      const isUxDirective = uxDirectiveMatch || uxNaturalKeywords.some(kw => lowerMsgCheck.includes(kw));

      if (isUxDirective && !isCreator) {
        return jsonOk({ reply: "⚠️ Seul l'administrateur créateur peut transmettre des directives à l'Agent UX.", conversation_id });
      }

      if (isUxDirective && isCreator) {
        const { data: bridgeConf4 } = await sb.from("admin_dashboard_config").select("card_order").eq("user_id", user_id).maybeSingle();
        const bridgeConfig4 = (bridgeConf4?.card_order as any) || {};
        if (bridgeConfig4.felix_ux_bridge === false) {
          return jsonOk({ reply: "⚠️ Le pont Félix → Agent UX est actuellement **désactivé**. Vous pouvez le réactiver depuis le Hub Intelligence (admin).", conversation_id });
        }
        try {
          const directiveText = uxDirectiveMatch
            ? uxDirectiveMatch[1].trim()
            : lastUserMsg;

          const compMatch = directiveText.match(/(?:composant|component|section|page)\s+([A-Za-z0-9_-]+)/i);
          const targetComponent = compMatch ? compMatch[1] : null;
          const urlMatch = directiveText.match(/(?:sur|pour|page|url)\s+(\/[^\s,]+|https?:\/\/[^\s,]+)/i);
          const targetUrl = urlMatch ? urlMatch[1] : null;

          await sb.from("agent_ux_directives").insert({
            user_id,
            directive_text: directiveText,
            target_component: targetComponent,
            target_url: targetUrl,
            status: 'pending',
          });

          fireDispatchAgentDirectives();

          const confirmReply = `✅ Directive transmise à l'Agent UX :\n\n> ${directiveText}\n\n${targetComponent ? `Composant cible : \`${targetComponent}\`\n` : ''}${targetUrl ? `URL cible : \`${targetUrl}\`\n` : ''}L'Agent UX sera déclenché immédiatement.`;

          let savedConvId = conversation_id;
          try {
            const allMessages = [...messages, { role: "assistant", content: confirmReply }];
            if (conversation_id) {
              await sb.from("sav_conversations").update({
                messages: allMessages,
                message_count: allMessages.length,
              }).eq("id", conversation_id);
            } else {
              const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();
              const { data: newConv } = await sb.from("sav_conversations").insert({
                user_id,
                user_email: prof?.email || null,
                messages: allMessages,
                message_count: allMessages.length,
              }).select("id").single();
              savedConvId = newConv?.id;
            }
          } catch (e) {
            console.error("Save UX directive conv error:", e);
          }

          return jsonOk({ reply: confirmReply, conversation_id: savedConvId || conversation_id });
        } catch (e) {
          console.error("UX directive error:", e);
        }
      }
      
      const backendKeywords = [
        "combien", "table", "base de données", "database", "requête", "query",
        "utilisateurs", "users", "profils", "profiles", "edge function",
        "erreurs", "errors", "logs", "statistiques", "stats", "métriques",
        "audit", "crawl", "conversations", "abonnés", "revenue", "coût",
        "lignes", "rows", "colonnes", "columns", "schema", "structure",
        "taille", "size", "cache", "cocoon", "sessions", "credits",
        "signalements", "bug_reports", "prédictions", "agent cto",
        "backlinks", "anomalies", "scripts", "plans d'action",
        "bundle", "api", "fair use", "rate limit", "événements",
        "affiliation", "affiliate", "GMB", "google", "CMS",
        "montre-moi", "show me", "list", "liste", "donne-moi",
        "quel est", "quels sont", "how many", "count",
        "dataforseo", "serpapi", "billing", "crédit api", "402", "facturation",
        "alerte", "notification", "alertes api",
      ];
      
      const lowerMsg = lastUserMsg.toLowerCase();
      const isBackendQuestion = backendKeywords.some(kw => lowerMsg.includes(kw.toLowerCase()));
      
      if (isBackendQuestion) {
        // Delegate to admin-backend-query
        try {
          const authHeader = req.headers.get("Authorization") || "";
          const queryResp = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/admin-backend-query`,
            {
              method: "POST",
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
                apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
              },
              body: JSON.stringify({ question: lastUserMsg }),
            }
          );

          if (queryResp.ok) {
            const queryData = await queryResp.json();
            
            // If the query was blocked, fall through to normal SAV chat
            if (queryData.blocked) {
              console.log("Admin query blocked, falling through to normal SAV");
              // Don't return — let it fall through to the normal AI chat below
            } else {
              // Format results for the creator
              let adminReply = "";
              if (queryData.error) {
                adminReply = `❌ Erreur d'exécution : ${queryData.error}\n\nRequête tentée :\n\`\`\`sql\n${queryData.query}\n\`\`\``;
              } else if (queryData.results === null && !queryData.query) {
                adminReply = `ℹ️ ${queryData.description}`;
              } else {
                adminReply = `📊 **${queryData.description}**\n\n`;
                if (queryData.query) {
                  adminReply += `\`\`\`sql\n${queryData.query}\n\`\`\`\n\n`;
                }
                if (Array.isArray(queryData.results)) {
                  if (queryData.results.length === 0) {
                    adminReply += "Aucun résultat.";
                  } else if (queryData.results.length === 1 && Object.keys(queryData.results[0]).length <= 3) {
                    const entries = Object.entries(queryData.results[0]);
                    adminReply += entries.map(([k, v]) => `**${k}** : ${v}`).join("\n");
                  } else {
                    const cols = Object.keys(queryData.results[0]);
                    adminReply += `| ${cols.join(" | ")} |\n`;
                    adminReply += `| ${cols.map(() => "---").join(" | ")} |\n`;
                    for (const row of queryData.results.slice(0, 30)) {
                      const vals = cols.map(c => {
                        const v = (row as any)[c];
                        if (v === null) return "-";
                        if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
                        return String(v).slice(0, 60);
                      });
                      adminReply += `| ${vals.join(" | ")} |\n`;
                    }
                    if (queryData.row_count > 30) {
                      adminReply += `\n_...et ${queryData.row_count - 30} lignes supplémentaires_`;
                    }
                  }
                  adminReply += `\n\n_${queryData.row_count} résultat(s)_`;
                }
              }

              if (adminReply.length > 3000) {
                adminReply = adminReply.substring(0, 2997) + "...";
              }

              let savedConvId = conversation_id;
              try {
                const allMessages = [...messages, { role: "assistant", content: adminReply }];
                if (conversation_id) {
                  await sb.from("sav_conversations").update({
                    messages: allMessages,
                    message_count: allMessages.length,
                  }).eq("id", conversation_id);
                } else {
                  const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();
                  const { data: newConv } = await sb.from("sav_conversations").insert({
                    user_id,
                    user_email: prof?.email || null,
                    messages: allMessages,
                    message_count: allMessages.length,
                  }).select("id").single();
                  savedConvId = newConv?.id;
                }
              } catch (e) {
                console.error("Save admin conv error:", e);
              }

              return jsonOk({ reply: adminReply, conversation_id: savedConvId || conversation_id });
            }
          }
        } catch (e) {
          console.error("Admin backend query error:", e);
          // Fall through to normal SAV agent
        }
      }
    }

    // ── Creator-only auto-detect: Parménion, Errors registry, Content Architect history ──
    // No /createur: prefix needed — just isCreator
    if (isCreator && !isCreatorMode) {
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      const lowerAutoCheck = lastUserMsg.toLowerCase();

      // Keywords for the 3 registries
      const parmenionAutoKw = ["parménion", "parmenion", "autopilot", "autopilote", "cycle en cours", "dernier cycle"];
      const errorsAutoKw = ["registre des erreurs", "erreurs récentes", "erreurs edge", "erreurs backend", "cocoon errors", "erreurs cocoon", "errors registry", "dernières erreurs", "journal des erreurs", "log des erreurs", "erreurs de production"];
      const contentArchitectAutoKw = ["historique de publication", "publications content architect", "batch operations", "historique content architect", "pages publiées", "historique cocoon", "dernières publications", "publication history", "contenus publiés", "déploiements content"];
      // Stats / metrics keywords — delegate to admin-backend-query
      const statsAutoKw = ["combien de script", "combien de audit", "combien de rapport", "combien d'audit", "combien d'utilisateur", "combien de crawl", "combien de user", "combien de pages", "combien de crédit", "combien de session", "combien de bug", "combien de conversation", "statistiques plateforme", "stats plateforme", "stats globales", "statistiques globales", "activité plateforme", "activité des users", "activité utilisateurs", "scripts générés", "audits générés", "rapports générés", "audits lancés", "crawls lancés", "aujourd'hui", "cette semaine", "ce mois"];

      const wantsParmenion = parmenionAutoKw.some(kw => lowerAutoCheck.includes(kw));
      const wantsErrors = errorsAutoKw.some(kw => lowerAutoCheck.includes(kw));
      const wantsContentHistory = contentArchitectAutoKw.some(kw => lowerAutoCheck.includes(kw));
      // Stats: must match a "combien" or stats keyword AND a time/entity keyword
      const hasStatsIntent = statsAutoKw.some(kw => lowerAutoCheck.includes(kw)) && 
        (lowerAutoCheck.includes("combien") || lowerAutoCheck.includes("statistique") || lowerAutoCheck.includes("stats") || lowerAutoCheck.includes("activité") || lowerAutoCheck.includes("générés") || lowerAutoCheck.includes("lancés"));

      if (wantsParmenion || wantsErrors || wantsContentHistory || hasStatsIntent) {

        // ── Stats delegation to admin-backend-query ──
        if (hasStatsIntent && !wantsParmenion && !wantsErrors && !wantsContentHistory) {
          try {
            const authHeader = req.headers.get("Authorization") || "";
            const queryResp = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/admin-backend-query`,
              {
                method: "POST",
                headers: {
                  Authorization: authHeader,
                  "Content-Type": "application/json",
                  apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
                },
                body: JSON.stringify({ question: lastUserMsg }),
              }
            );

            if (queryResp.ok) {
              const queryData = await queryResp.json();
              if (!queryData.blocked) {
                let statsReply = "";
                if (queryData.error) {
                  statsReply = `❌ Erreur : ${queryData.error}`;
                } else {
                  statsReply = `📊 **${queryData.description}**\n\n`;
                  if (Array.isArray(queryData.results)) {
                    if (queryData.results.length === 0) {
                      statsReply += "Aucun résultat.";
                    } else if (queryData.results.length === 1 && Object.keys(queryData.results[0]).length <= 4) {
                      const entries = Object.entries(queryData.results[0]);
                      statsReply += entries.map(([k, v]) => `**${k}** : ${v}`).join("\n");
                    } else {
                      const cols = Object.keys(queryData.results[0]);
                      statsReply += `| ${cols.join(" | ")} |\n`;
                      statsReply += `| ${cols.map(() => "---").join(" | ")} |\n`;
                      for (const row of queryData.results.slice(0, 20)) {
                        const vals = cols.map(c => {
                          const v = (row as any)[c];
                          if (v === null) return "-";
                          if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
                          return String(v).slice(0, 60);
                        });
                        statsReply += `| ${vals.join(" | ")} |\n`;
                      }
                    }
                    statsReply += `\n\n_${queryData.row_count} résultat(s)_`;
                  }
                }

                if (statsReply.length > 3000) statsReply = statsReply.substring(0, 2997) + "...";

                let savedConvId = conversation_id;
                try {
                  const allMessages = [...messages, { role: "assistant", content: statsReply }];
                  if (conversation_id) {
                    await sb.from("sav_conversations").update({ messages: allMessages, message_count: allMessages.length }).eq("id", conversation_id);
                  } else {
                    const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();
                    const { data: newConv } = await sb.from("sav_conversations").insert({ user_id, user_email: prof?.email || null, messages: allMessages, message_count: allMessages.length }).select("id").single();
                    savedConvId = newConv?.id;
                  }
                } catch (e) { console.error("Save stats conv error:", e); }

                return jsonOk({ reply: statsReply, conversation_id: savedConvId || conversation_id });
              }
            }
          } catch (e) {
            console.error("Stats auto-detect error:", e);
            // Fall through
          }
        }

        try {
          let creatorContext = "\n\n# CONTEXTE CRÉATEUR (AUTO-DETECT)\n";

          // ── Parménion ──
          if (wantsParmenion) {
            const [decisionsResp, configsResp] = await Promise.all([
              sb.from("parmenion_decision_log")
                .select("cycle_number, goal_type, goal_description, action_type, status, impact_level, risk_predicted, is_error, error_category, impact_predicted, impact_actual, created_at, domain, execution_error")
                .order("created_at", { ascending: false })
                .limit(10),
              sb.from("autopilot_configs")
                .select("tracked_site_id, is_active, status, last_cycle_at, total_cycles_run, implementation_mode, cooldown_hours")
                .limit(5),
            ]);

            creatorContext += "\n## Parménion — État autopilote\n";
            if (configsResp.data?.length) {
              for (const cfg of configsResp.data) {
                creatorContext += `- Site ${cfg.tracked_site_id}: ${cfg.is_active ? '🟢 ACTIF' : '⏸️ PAUSE'} | Mode: ${cfg.implementation_mode} | ${cfg.total_cycles_run || 0} cycles | Dernier: ${cfg.last_cycle_at?.slice(0, 16) || 'jamais'}\n`;
              }
            }
            if (decisionsResp.data?.length) {
              creatorContext += "\n### Dernières décisions\n";
              for (const d of decisionsResp.data) {
                creatorContext += `- Cycle ${d.cycle_number} — ${d.domain} (${d.created_at?.slice(0, 16)}) : ${d.goal_description} | ${d.action_type} → ${d.status}${d.is_error ? ' ⚠️ ERREUR: ' + (d.error_category || '') : ''}${d.execution_error ? ' ❌ ' + d.execution_error : ''}\n`;
              }
            }
          }

          // ── Registre des erreurs ──
          if (wantsErrors) {
            const [cocoonErrResp, parmenionErrResp] = await Promise.all([
              sb.from("cocoon_errors")
                .select("domain, problem_description, created_at, is_crawled, ai_response")
                .order("created_at", { ascending: false })
                .limit(15),
              sb.from("parmenion_decision_log")
                .select("cycle_number, domain, goal_description, error_category, calibration_note, execution_error, created_at")
                .eq("is_error", true)
                .order("created_at", { ascending: false })
                .limit(10),
            ]);

            creatorContext += "\n## Registre des erreurs\n";
            if (cocoonErrResp.data?.length) {
              creatorContext += "\n### Erreurs Cocoon récentes\n";
              for (const e of cocoonErrResp.data) {
                creatorContext += `- [${e.created_at?.slice(0, 16)}] ${e.domain} : ${e.problem_description?.slice(0, 120)}${e.is_crawled ? ' (crawled)' : ''}${e.ai_response ? ' → Réponse IA fournie' : ''}\n`;
              }
            }
            if (parmenionErrResp.data?.length) {
              creatorContext += "\n### Erreurs Parménion récentes\n";
              for (const e of parmenionErrResp.data) {
                creatorContext += `- [${e.created_at?.slice(0, 16)}] Cycle ${e.cycle_number} — ${e.domain} : ${e.goal_description} | ${e.error_category || 'non catégorisée'}${e.calibration_note ? ' — ' + e.calibration_note : ''}${e.execution_error ? ' ❌ ' + e.execution_error : ''}\n`;
              }
            }
            if (!cocoonErrResp.data?.length && !parmenionErrResp.data?.length) {
              creatorContext += "Aucune erreur récente détectée. ✅\n";
            }
          }

          // ── Historique de publication Content Architect ──
          if (wantsContentHistory) {
            const batchResp = await sb.from("cocoon_batch_operations")
              .select("domain, operation_type, mode, status, total_pages, processed_pages, failed_pages, created_at, completed_at, error_message")
              .order("created_at", { ascending: false })
              .limit(15);

            creatorContext += "\n## Historique de publication Content Architect\n";
            if (batchResp.data?.length) {
              for (const b of batchResp.data) {
                creatorContext += `- [${b.created_at?.slice(0, 16)}] ${b.domain} : ${b.operation_type} (${b.mode}) → ${b.status} | ${b.processed_pages}/${b.total_pages} pages${b.failed_pages ? ` (${b.failed_pages} échecs)` : ''}${b.completed_at ? ' | Terminé: ' + b.completed_at.slice(0, 16) : ''}${b.error_message ? ' ❌ ' + b.error_message : ''}\n`;
              }
            } else {
              creatorContext += "Aucune opération de publication récente.\n";
            }
          }

          creatorContext += "\n## INSTRUCTIONS\nTu es en mode créateur auto-détecté. Présente ces données de manière claire et structurée. Utilise un ton direct et technique adapté au créateur de la plateforme.";

          // Build prompt and call LLM
          const autoPrompt = SYSTEM_PROMPT + creatorContext + `\n\n# MODE CRÉATEUR\nCet utilisateur est le créateur de la plateforme.`;
          const aiMessages = [
            { role: "system", content: autoPrompt },
            ...messages.slice(-20),
          ];

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: aiMessages,
              stream: false,
              max_tokens: 2500,
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            logAIUsageFromResponse(sb, "google/gemini-2.5-flash", "sav-agent", aiData.usage);
            let reply = aiData.choices?.[0]?.message?.content || "Je n'ai pas pu récupérer ces informations.";
            if (reply.length > 3000) reply = reply.substring(0, 2997) + "...";

            let savedConvId = conversation_id;
            try {
              const allMessages = [...messages, { role: "assistant", content: reply }];
              if (conversation_id) {
                await sb.from("sav_conversations").update({ messages: allMessages, message_count: allMessages.length }).eq("id", conversation_id);
              } else {
                const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();
                const { data: newConv } = await sb.from("sav_conversations").insert({ user_id, user_email: prof?.email || null, messages: allMessages, message_count: allMessages.length }).select("id").single();
                savedConvId = newConv?.id;
              }
            } catch (e) { console.error("Save creator auto-detect conv error:", e); }

            return jsonOk({ reply, conversation_id: savedConvId || conversation_id });
          }
        } catch (e) {
          console.error("Creator auto-detect context error:", e);
          // Fall through to normal flow
        }
      }
    }

    // ── Enrich context (skip for guests) ──
    let contextSnippet = "";
    let userFirstName = "";
    if (!isGuest && user_id) {
    try {
      // Fetch profile (plan, credits, first name)
      const { data: profile } = await sb
        .from("profiles")
        .select("plan_type, credits_balance, subscription_status, first_name, email, autonomy_score, autonomy_level")
        .eq("user_id", user_id)
        .single();

      if (profile) {
        userFirstName = (profile as any).first_name || "";
        const userPlan = (profile as any).plan_type || "free";
        const userCredits = (profile as any).credits_balance ?? 0;
        const userSubStatus = (profile as any).subscription_status || "aucun";
        contextSnippet += `\n\n# PROFIL UTILISATEUR\n- Prénom: ${(profile as any).first_name || 'inconnu'}\n- Plan: ${userPlan}\n- Crédits: ${userCredits}\n- Statut: ${userSubStatus}\n- Email: ${(profile as any).email || 'inconnu'}\n`;

        // Inject autonomy-based behaviour adaptation (from shared personas)
        const autonomyLevel = (profile as any).autonomy_level;
        const autonomyScore = (profile as any).autonomy_score;
        if (autonomyLevel && autonomyScore != null) {
          contextSnippet += `\n${getAutonomyBlock(autonomyLevel, autonomyScore)}\n`;
        }

        // ── ALERTES PROACTIVES : crédits + crawl ──
        // Fetch crawl pages used this month
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const { data: monthCrawls } = await sb
          .from("site_crawls")
          .select("crawled_pages")
          .eq("user_id", user_id)
          .gte("created_at", monthStart.toISOString());

        const totalCrawledPages = (monthCrawls || []).reduce((sum: number, c: any) => sum + (c.crawled_pages || 0), 0);

        // Plan crawl limits
        const crawlLimits: Record<string, number> = { free: 500, agency_pro: 5000, agency_premium: 50000 };
        const maxCrawlPages = crawlLimits[userPlan] || crawlLimits.free;
        const crawlUsagePercent = Math.round((totalCrawledPages / maxCrawlPages) * 100);

        let alertBlock = "";

        // Credit alerts
        if (userCredits <= 0) {
          alertBlock += `\n⚠️ ALERTE CRÉDITS ÉPUISÉS : L'utilisateur n'a plus de crédits (solde: ${userCredits}). `;
          if (userPlan === 'free') {
            alertBlock += `Suggère de passer au plan Pro Agency (29€/mois) pour bénéficier de l'Audit Expert et du Code Correctif illimités + 5000 pages de crawl. Lien : [Voir Pro Agency](https://crawlers.fr/pro-agency)`;
          } else {
            alertBlock += `Suggère de recharger avec un pack de crédits (Premium : 150 crédits à 45€) depuis [Mon Portefeuille](https://crawlers.fr/console) > onglet Pro Agency.`;
          }
        } else if (userCredits <= 3) {
          alertBlock += `\n⚠️ ALERTE CRÉDITS BAS : Il ne reste que ${userCredits} crédit(s). `;
          if (userPlan === 'free') {
            alertBlock += `Mentionne que le plan Pro Agency (29€/mois) offre l'Audit Expert et le Code Correctif illimités. [Voir Pro Agency](https://crawlers.fr/pro-agency)`;
          } else {
            alertBlock += `Propose de recharger avec le Pack Premium (150 crédits à 45€) depuis l'onglet Pro Agency dans la Console.`;
          }
        }

        // Crawl alerts
        if (crawlUsagePercent >= 100) {
          alertBlock += `\n⚠️ ALERTE CRAWL PLAFOND ATTEINT : ${totalCrawledPages}/${maxCrawlPages} pages crawlées ce mois (${crawlUsagePercent}%). `;
          if (userPlan === 'agency_pro') {
            alertBlock += `Suggère de passer à Pro Agency + (79€/mois) pour 50 000 pages/mois et 50 pages/scan. [Voir Pro Agency +](https://crawlers.fr/pro-agency)`;
          } else if (userPlan === 'free') {
            alertBlock += `Suggère Pro Agency (29€/mois) pour 5 000 pages/mois. [Voir Pro Agency](https://crawlers.fr/pro-agency)`;
          }
        } else if (crawlUsagePercent >= 80) {
          alertBlock += `\n⚠️ ALERTE CRAWL PROCHE DU PLAFOND : ${totalCrawledPages}/${maxCrawlPages} pages crawlées ce mois (${crawlUsagePercent}%). `;
          if (userPlan === 'agency_pro') {
            alertBlock += `Informe que Pro Agency + (79€/mois) offre 50 000 pages/mois si besoin. [Voir Pro Agency +](https://crawlers.fr/pro-agency)`;
          } else if (userPlan === 'free') {
            alertBlock += `Suggère Pro Agency (29€/mois) pour 5 000 pages/mois. [Voir Pro Agency](https://crawlers.fr/pro-agency)`;
          }
        }

        if (alertBlock) {
          contextSnippet += `\n# ALERTES PROACTIVES — MENTIONNER NATURELLEMENT DANS LA RÉPONSE
Ces alertes doivent être intégrées naturellement dans ta réponse. Ne les ignore pas. Intègre l'information de façon fluide, pas comme un bandeau publicitaire.
${alertBlock}\n`;
        }
      }

      // Fetch tracked sites — include team-shared sites if applicable
      const { data: accessibleSiteIds } = await sb.rpc('get_team_accessible_sites', { p_user_id: user_id });
      const siteIds: string[] = Array.isArray(accessibleSiteIds) ? accessibleSiteIds : [];

      let sites: any[] = [];
      if (siteIds.length > 0) {
        const { data: sitesData } = await sb
          .from("tracked_sites")
          .select("id, domain, display_name, geo_score, seo_score, llm_visibility_score, created_at, user_id, shared_with_team")
          .in("id", siteIds)
          .limit(10);
        sites = sitesData || [];
      } else {
        // Fallback: own sites only
        const { data: sitesData } = await sb
          .from("tracked_sites")
          .select("id, domain, display_name, geo_score, seo_score, llm_visibility_score, created_at, user_id, shared_with_team")
          .eq("user_id", user_id)
          .limit(10);
        sites = sitesData || [];
      }

      if (sites && sites.length > 0) {
        contextSnippet += "\n# SITES TRACKÉS DE L'UTILISATEUR\n";
        const ownSites = sites.filter((s: any) => s.user_id === user_id);
        const sharedSites = sites.filter((s: any) => s.user_id !== user_id);
        for (const s of ownSites) {
          contextSnippet += `- ${s.display_name || s.domain}: GEO ${s.geo_score ?? "N/A"}, SEO ${s.seo_score ?? "N/A"}%, LLM ${s.llm_visibility_score ?? "N/A"}% (ajouté le ${s.created_at?.slice(0, 10)})\n`;
        }
        if (sharedSites.length > 0) {
          contextSnippet += "\n# SITES PARTAGÉS PAR LE PROPRIÉTAIRE DU COMPTE\n";
          for (const s of sharedSites) {
            contextSnippet += `- [partagé] ${s.display_name || s.domain}: GEO ${s.geo_score ?? "N/A"}, SEO ${s.seo_score ?? "N/A"}%, LLM ${s.llm_visibility_score ?? "N/A"}%\n`;
          }
        }

        // Read persistent memory + cocoon diagnostics for each site
        for (const s of sites.slice(0, 3)) {
          try {
            const { promptSnippet: memSnippet } = await readSiteMemory(s.id);
            if (memSnippet) {
              contextSnippet += `\n### Mémoire ${s.display_name || s.domain}${memSnippet}`;
            }
            // Check pending identity suggestions
            const pending = await getPendingSuggestions(s.id);
            if (pending.length > 0) {
              contextSnippet += `\n⚠ ${pending.length} suggestion(s) de carte d'identité en attente de validation pour ${s.domain}\n`;
              for (const p of pending.slice(0, 3)) {
                contextSnippet += `  - ${p.field_name}: "${p.current_value}" → "${p.suggested_value}" (${p.reason})\n`;
              }
            }

            // ── CROSS-AGENT: Inject Cocoon diagnostics into Félix context ──
            try {
              const { snippet: cocoonSnippet } = await getCocoonDiagnosticsForFelix(s.id);
              if (cocoonSnippet) {
                contextSnippet += cocoonSnippet;
              }
            } catch (e) {
              console.error(`[sav-agent] Cocoon diagnostics error for ${s.domain}:`, e);
            }

            // ── CROSS-AGENT: Inject Workbench findings into Félix context ──
            try {
              const { data: wbItems } = await sb
                .from('architect_workbench')
                .select('title, finding_category, severity, source_function, target_url, created_at, status')
                .eq('domain', s.domain)
                .eq('user_id', s.user_id || user_id)
                .in('status', ['pending', 'assigned', 'in_progress'])
                .order('severity', { ascending: true })
                .limit(10);

              if (wbItems?.length) {
                const sourceLabel: Record<string, string> = {
                  'parse-matrix-hybrid': 'Matrice',
                  'cocoon-strategist': 'Stratège Cocoon',
                  'audit-strategique-ia': 'Audit Stratégique',
                  'audit_recommendations_registry': 'Audit Technique',
                  'analyze-ux-context': 'Conversion Optimizer',
                  'sav-agent': 'Félix',
                };
                contextSnippet += `\n### 🏗️ Workbench ${s.display_name || s.domain} (${wbItems.length} findings actifs)\n`;
                for (const wb of wbItems) {
                  const src = sourceLabel[wb.source_function || ''] || wb.source_function || '?';
                  const sev = wb.severity === 'critical' ? '🔴' : wb.severity === 'high' ? '🟠' : '🟡';
                  contextSnippet += `  ${sev} [${src}] ${wb.title} (${wb.finding_category}, ${wb.status})\n`;
                }
              }
            } catch (e) {
              console.error(`[sav-agent] Workbench read error for ${s.domain}:`, e);
            }

            // ── CROSS-AGENT: Detect feedback loop (user returns with same problem) ──
            try {
              const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
              const feedbackHint = await detectFeedbackLoop(user_id, s.id, s.domain, lastUserMsg);
              if (feedbackHint) {
                contextSnippet += feedbackHint;
              }
            } catch (e) {
              console.error(`[sav-agent] Feedback loop detection error:`, e);
            }
          } catch (e) {
            console.error(`[sav-agent] Memory read error for ${s.domain}:`, e);
          }
        }

        // For each site, fetch latest audit & crawl info (use s.user_id for proper data isolation)
        for (const s of sites.slice(0, 5)) {
          const siteOwnerId = s.user_id || user_id;
          // ── RAW AUDIT DATA: fetch payload for ALL audit types ──
          const { data: allAudits } = await sb
            .from("audit_raw_data")
            .select("audit_type, created_at, raw_payload")
            .eq("domain", s.domain)
            .eq("user_id", siteOwnerId)
            .order("created_at", { ascending: false })
            .limit(5);

          if (allAudits?.length) {
            contextSnippet += `  Audits ${s.domain}: ${allAudits.map(a => `${a.audit_type} (${a.created_at?.slice(0, 10)})`).join(', ')}\n`;

            // Extract key data from each audit's raw_payload
            for (const audit of allAudits) {
              const rp = audit.raw_payload as any;
              if (!rp) continue;

              try {
                switch (audit.audit_type) {
                  case 'eeat': {
                    contextSnippet += `  E-E-A-T ${s.domain} (${audit.created_at?.slice(0, 10)}): score ${rp.score}/100 — Exp: ${rp.experience}, Expert: ${rp.expertise}, Auth: ${rp.authoritativeness}, Trust: ${rp.trustworthiness}\n`;
                    if (rp.issues?.length) contextSnippet += `    Problèmes E-E-A-T: ${rp.issues.slice(0, 3).join('; ')}\n`;
                    if (rp.strengths?.length) contextSnippet += `    Forces E-E-A-T: ${rp.strengths.slice(0, 3).join('; ')}\n`;
                    break;
                  }
                  case 'technical':
                  case 'seo': {
                    // Scores globaux
                    if (rp.scores) {
                      const sc = rp.scores;
                      contextSnippet += `  Scores techniques ${s.domain}: Performance ${sc.performance ?? '?'}, SEO ${sc.seo ?? '?'}, Accessibilité ${sc.accessibility ?? '?'}, Bonnes pratiques ${sc.bestPractices ?? '?'}\n`;
                    }
                    // Bots IA — détail complet
                    if (rp.ai_bots || rp.bots || rp.crawlers) {
                      const bots = rp.ai_bots || rp.bots || rp.crawlers;
                      if (Array.isArray(bots)) {
                        const blocked = bots.filter((b: any) => b.blocked || b.status === 'blocked' || b.allowed === false);
                        const allowed = bots.filter((b: any) => !b.blocked && b.status !== 'blocked' && b.allowed !== false);
                        contextSnippet += `  🤖 Bots IA ${s.domain}: ${allowed.length} autorisés, ${blocked.length} bloqués\n`;
                        if (blocked.length > 0) {
                          contextSnippet += `    🔴 Bloqués: ${blocked.map((b: any) => b.name || b.bot_name || b.bot).join(', ')}\n`;
                        }
                        if (allowed.length > 0) {
                          contextSnippet += `    ✅ Autorisés: ${allowed.map((b: any) => b.name || b.bot_name || b.bot).join(', ')}\n`;
                        }
                      }
                    }
                    // Robots.txt
                    if (rp.robots_txt || rp.robotsTxt) {
                      const rt = rp.robots_txt || rp.robotsTxt;
                      contextSnippet += `  robots.txt ${s.domain}: ${rt.exists ? '✅ Existe' : '❌ Absent'}${rt.has_sitemap ? ', sitemap déclaré' : ''}${rt.has_disallow_all ? ', ⚠ Disallow: / détecté' : ''}\n`;
                    }
                    // CWV / Performance
                    if (rp.core_web_vitals || rp.cwv) {
                      const cwv = rp.core_web_vitals || rp.cwv;
                      contextSnippet += `  CWV ${s.domain}: LCP ${cwv.lcp ?? '?'}ms, FID/INP ${cwv.inp ?? cwv.fid ?? '?'}ms, CLS ${cwv.cls ?? '?'}\n`;
                    }
                    // Sémantique
                    if (rp.meta_title || rp.title) {
                      contextSnippet += `  Title ${s.domain}: "${(rp.meta_title || rp.title)?.slice(0, 60)}"\n`;
                    }
                    if (rp.h1) {
                      contextSnippet += `  H1 ${s.domain}: "${(typeof rp.h1 === 'string' ? rp.h1 : rp.h1?.text || rp.h1?.[0])?.slice(0, 60)}"\n`;
                    }
                    // JSON-LD
                    if (rp.json_ld || rp.jsonLd || rp.structured_data) {
                      const jld = rp.json_ld || rp.jsonLd || rp.structured_data;
                      if (jld.types?.length) contextSnippet += `  JSON-LD ${s.domain}: ${jld.types.join(', ')}\n`;
                      else if (Array.isArray(jld)) contextSnippet += `  JSON-LD ${s.domain}: ${jld.length} schémas détectés\n`;
                    }
                    // Weaknesses / Strengths
                    if (rp.weaknesses?.length) {
                      contextSnippet += `  ⚠ Faiblesses ${s.domain}: ${rp.weaknesses.slice(0, 5).map((w: any) => typeof w === 'string' ? w : w.title || w.description || JSON.stringify(w)).join(' | ')}\n`;
                    }
                    if (rp.strengths?.length) {
                      contextSnippet += `  ✅ Forces ${s.domain}: ${rp.strengths.slice(0, 3).map((w: any) => typeof w === 'string' ? w : w.title || w.description || JSON.stringify(w)).join(' | ')}\n`;
                    }
                    // Recommendations
                    if (rp.recommendations?.length) {
                      contextSnippet += `  📋 Recommandations ${s.domain} (${rp.recommendations.length}): ${rp.recommendations.slice(0, 3).map((r: any) => r.title || r.description || '').join(' | ')}\n`;
                    }
                    break;
                  }
                  case 'strategic':
                  case 'strategic_parallel': {
                    if (rp.keyword_positioning?.main_keywords?.length) {
                      const kws = rp.keyword_positioning.main_keywords.slice(0, 5);
                      contextSnippet += `  Mots-clés ${s.domain}: ${kws.map((k: any) => `${k.keyword} (vol:${k.volume}, pos:#${k.current_rank || '?'})`).join(', ')}\n`;
                    }
                    if (rp.keyword_positioning?.quick_wins?.length) {
                      contextSnippet += `  Quick wins ${s.domain}: ${rp.keyword_positioning.quick_wins.slice(0, 3).map((q: any) => q.keyword || q.title).join(', ')}\n`;
                    }
                    if (rp.priority_content?.missing_pages?.length) {
                      contextSnippet += `  Pages manquantes ${s.domain}: ${rp.priority_content.missing_pages.slice(0, 3).map((p: any) => p.title).join(', ')}\n`;
                    }
                    if (rp.strengths?.length) {
                      contextSnippet += `  Forces stratégiques: ${rp.strengths.slice(0, 3).join('; ')}\n`;
                    }
                    if (rp.weaknesses?.length) {
                      contextSnippet += `  Faiblesses stratégiques: ${rp.weaknesses.slice(0, 3).join('; ')}\n`;
                    }
                    break;
                  }
                  default: {
                    // Generic fallback: extract scores, strengths, weaknesses from any audit
                    if (rp.score !== undefined) contextSnippet += `  ${audit.audit_type} ${s.domain}: score ${rp.score}\n`;
                    if (rp.strengths?.length) contextSnippet += `  Forces (${audit.audit_type}): ${rp.strengths.slice(0, 3).join('; ')}\n`;
                    if (rp.weaknesses?.length) contextSnippet += `  Faiblesses (${audit.audit_type}): ${rp.weaknesses.slice(0, 3).join('; ')}\n`;
                    if (rp.recommendations?.length) contextSnippet += `  Recos (${audit.audit_type}): ${rp.recommendations.slice(0, 3).map((r: any) => r.title || r).join('; ')}\n`;
                    break;
                  }
                }
              } catch (auditErr) {
                console.error(`[sav-agent] Error extracting ${audit.audit_type} payload for ${s.domain}:`, auditErr);
              }
            }
          } else {
            contextSnippet += `  ⚠ ${s.domain}: aucun audit réalisé\n`;
          }

          // GSC connection check
          const { data: gsc } = await sb
            .from("gsc_history_log")
            .select("week_start_date")
            .eq("tracked_site_id", s.id)
            .order("week_start_date", { ascending: false })
            .limit(1);

          if (!gsc?.length) {
            contextSnippet += `  ⚠ ${s.domain}: pas de données GSC connectées\n`;
          }

          // Bot log analysis
          try {
            const { data: botLog } = await sb.rpc('get_bot_log_summary', { p_tracked_site_id: s.id });
            if (botLog && typeof botLog === 'object' && (botLog as any).total_entries > 0) {
              const bl = botLog as any;
              contextSnippet += `  Logs bots ${s.domain}: ${bl.total_bot_hits} hits bots (${bl.unique_bots} uniques) sur 7j`;
              if (bl.ai_bots?.length) {
                contextSnippet += ` | Bots IA: ${bl.ai_bots.map((b: any) => `${b.bot_name}(${b.hits})`).join(', ')}`;
              } else {
                contextSnippet += ` | ⚠ Aucun bot IA détecté`;
              }
              if (bl.error_rate > 10) {
                contextSnippet += ` | ⚠ ${bl.error_rate}% erreurs bots`;
              }
              contextSnippet += '\n';
            }
          } catch (_) { /* best effort */ }
        }

          // ── SEASONAL CONTEXT + NEWS ──
          try {
            const { data: seasonalCtx } = await sb.rpc('get_active_seasonal_context', {
              p_sector: (s as any).market_sector || null,
              p_geo: 'FR',
            });
            if (seasonalCtx?.length) {
              const peaks = seasonalCtx.filter((sc: any) => sc.is_in_peak);
              const preps = seasonalCtx.filter((sc: any) => sc.is_in_prep && !sc.is_in_peak);
              if (peaks.length || preps.length) {
                contextSnippet += `\n### 🗓️ Contexte saisonnier ${s.domain}\n`;
                for (const p of peaks) {
                  contextSnippet += `  🔴 PIC ACTUEL: ${p.event_name} — Keywords: ${(p.peak_keywords || []).join(', ')}\n`;
                }
                for (const p of preps) {
                  contextSnippet += `  🟡 PRÉPA (J-${p.days_until_start}): ${p.event_name} — Keywords: ${(p.peak_keywords || []).join(', ')}\n`;
                }
                contextSnippet += `  → Vérifie si ${s.domain} a des pages couvrant ces sujets. Si oui, sont-elles à jour et performantes ?\n`;
              }
            }

            // Fetch sector news
            const { data: sectorNews } = await sb.rpc('get_seasonal_news', {
              p_sector: (s as any).market_sector || null,
              p_geo: 'FR',
              p_limit: 3,
            });
            if (sectorNews?.length) {
              contextSnippet += `\n### 📰 Actualités sectorielles ${s.domain}\n`;
              for (const n of sectorNews) {
                contextSnippet += `  [${n.news_type}] ${n.headline}\n    → ${n.summary || ''}\n`;
              }
            }
          } catch (_) { /* best effort */ }

        // ── Fetch Top 5 Priority Pages per site ──
        for (const s of sites) {
          try {
            const { data: priorityPages } = await sb
              .from('page_priority_scores')
              .select('page_url, priority_score, top_opportunities')
              .eq('tracked_site_id', s.id)
              .order('priority_score', { ascending: false })
              .limit(5);

            if (priorityPages?.length) {
              contextSnippet += `\n# 🎯 TOP 5 PAGES PRIORITAIRES À OPTIMISER — ${s.domain}\n`;
              for (let i = 0; i < priorityPages.length; i++) {
                const p = priorityPages[i];
                const opps = (p.top_opportunities as string[]) || [];
                contextSnippet += `${i + 1}. **${p.page_url}** (score ${p.priority_score}/100)${opps[0] ? ` → ${opps[0]}` : ''}\n`;
              }
              contextSnippet += `\nIMPORTANT : Quand l'utilisateur parle d'un audit ou demande quoi optimiser, commence TOUJOURS par lister ces 5 pages sans expliquer la méthode de calcul (sauf si on te le demande).\n`;
            }
          } catch (_) { /* best effort */ }
        }
      }
    } catch (e) {
      console.error("Context enrichment error:", e);
    }
    } // end if (!isGuest)

    // ── Live Search: Felix answers user questions using DataForSEO / SerpAPI / Google Places ──
    let liveSearchContext = "";
    if (!isGuest && user_id) {
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      const lowerSearch = lastUserMsg.toLowerCase();

      // Detect search intent keywords
      const serpKeywords = [
        "position google", "résultats google", "classement google", "serp", "ranking",
        "première page", "top 10", "top 3", "mot-clé", "mot clé", "keyword",
        "cherche sur google", "recherche google", "qui est premier", "qui apparaît",
        "quelle position", "quel classement", "résultats de recherche",
        "concurrents sur", "qui se positionne", "visibilité sur google",
      ];
      const placesKeywords = [
        "avis google", "fiche google", "google maps", "note google", "étoiles google",
        "avis clients", "google my business", "gmb", "fiche établissement",
        "restaurant", "magasin", "commerce", "horaires", "adresse de",
        "avis sur", "note de", "où se trouve", "trouver un", "trouver une",
      ];

      const isSerpIntent = serpKeywords.some(kw => lowerSearch.includes(kw));
      const isPlacesIntent = placesKeywords.some(kw => lowerSearch.includes(kw));
      const hasSearchIntent = isSerpIntent || isPlacesIntent;

      if (hasSearchIntent) {
        // Check plan type for rate limiting
        const { data: planProfile } = await sb
          .from("profiles")
          .select("plan_type, subscription_status")
          .eq("user_id", user_id)
          .single();

        const isPro = planProfile?.plan_type === "agency_pro" &&
          (planProfile?.subscription_status === "active" || planProfile?.subscription_status === "canceling");

        // For free users: check if they already used their 1 live search this session
        let searchAllowed = true;
        if (!isPro && !isCreator && conversation_id) {
          const { data: convData } = await sb
            .from("sav_conversations")
            .select("metadata")
            .eq("id", conversation_id)
            .maybeSingle();

          const metadata = (convData?.metadata as any) || {};
          const liveSearchCount = metadata.live_search_count || 0;
          if (liveSearchCount >= 1) {
            searchAllowed = false;
            liveSearchContext = `\n\n# RECHERCHE EN DIRECT — LIMITE ATTEINTE
L'utilisateur gratuit a déjà utilisé sa recherche en direct pour cette conversation. 
Explique-lui qu'il peut passer à Pro Agency pour des recherches illimitées, ou ouvrir une nouvelle conversation.
Ne fais PAS de recherche, réponds avec tes connaissances existantes.`;
          }
        }

        if (searchAllowed) {
          try {
            // Extract search query from the user message using a simple heuristic
            let searchQuery = lastUserMsg
              .replace(/position google|résultats google|classement google|cherche sur google|recherche google|qui est premier|qui apparaît sur|avis google|fiche google|google maps|note google|sur google|dans google/gi, "")
              .replace(/pour|de|du|des|le|la|les|un|une|mon|ma|mes|quel|quelle|quels|quelles|est|sont|donne|montre|affiche/gi, "")
              .trim();

            // If query is too short, use the full message
            if (searchQuery.length < 3) searchQuery = lastUserMsg;

            let searchResults: any = null;
            let searchSource = "";

            if (isPlacesIntent) {
              // Google Places API
              const GOOGLE_PLACES_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
              if (GOOGLE_PLACES_KEY) {
                const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&language=fr&key=${GOOGLE_PLACES_KEY}`;
                const placesResp = await fetch(placesUrl);
                if (placesResp.ok) {
                  const placesData = await placesResp.json();
                  const topResults = (placesData.results || []).slice(0, 5).map((r: any) => ({
                    name: r.name,
                    address: r.formatted_address,
                    rating: r.rating,
                    reviews_count: r.user_ratings_total,
                    types: r.types?.slice(0, 3),
                    open_now: r.opening_hours?.open_now,
                  }));
                  searchResults = topResults;
                  searchSource = "Google Places";
                }
              }
            }

            if (isSerpIntent && !searchResults) {
              // Try DataForSEO first, fallback to SerpAPI
              const DFS_LOGIN = Deno.env.get("DATAFORSEO_LOGIN");
              const DFS_PASS = Deno.env.get("DATAFORSEO_PASSWORD");
              const SERP_KEY = Deno.env.get("SERPAPI_KEY");

              if (DFS_LOGIN && DFS_PASS) {
                try {
                  const dfsResp = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
                    method: "POST",
                    headers: {
                      Authorization: "Basic " + btoa(`${DFS_LOGIN}:${DFS_PASS}`),
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify([{
                      keyword: searchQuery,
                      language_name: "French",
                      location_name: "France",
                      depth: 10,
                    }]),
                  });

                  if (dfsResp.ok) {
                    const dfsData = await dfsResp.json();
                    const items = dfsData?.tasks?.[0]?.result?.[0]?.items || [];
                    const organic = items
                      .filter((i: any) => i.type === "organic")
                      .slice(0, 10)
                      .map((i: any) => ({
                        position: i.rank_absolute,
                        title: i.title,
                        url: i.url,
                        description: i.description?.slice(0, 120),
                      }));
                    searchResults = organic;
                    searchSource = "Google SERP (live)";
                  }
                } catch (e) {
                  console.error("[Felix Live Search] DataForSEO error:", e);
                }
              }

              // Fallback to SerpAPI
              if (!searchResults && SERP_KEY) {
                try {
                  const serpUrl = `https://serpapi.com/search.json?api_key=${SERP_KEY}&engine=google&q=${encodeURIComponent(searchQuery)}&hl=fr&gl=fr&num=10`;
                  const serpResp = await fetch(serpUrl);
                  if (serpResp.ok) {
                    const serpData = await serpResp.json();
                    const organic = (serpData.organic_results || []).slice(0, 10).map((r: any) => ({
                      position: r.position,
                      title: r.title,
                      url: r.link,
                      description: r.snippet?.slice(0, 120),
                    }));
                    searchResults = organic;
                    searchSource = "Google SERP (live)";
                  }
                } catch (e) {
                  console.error("[Felix Live Search] SerpAPI error:", e);
                }
              }
            }

            if (searchResults && searchResults.length > 0) {
              liveSearchContext = `\n\n# RÉSULTATS DE RECHERCHE EN DIRECT (${searchSource})
Requête : "${searchQuery}"
Résultats obtenus en temps réel :\n`;

              if (isPlacesIntent) {
                for (const r of searchResults) {
                  liveSearchContext += `- **${r.name}** — ${r.address || "adresse inconnue"} | Note: ${r.rating ?? "N/A"}/5 (${r.reviews_count ?? 0} avis)${r.open_now !== undefined ? (r.open_now ? " 🟢 Ouvert" : " 🔴 Fermé") : ""}\n`;
                }
              } else {
                for (const r of searchResults) {
                  liveSearchContext += `${r.position}. [${r.title}](${r.url}) — ${r.description || ""}\n`;
                }
              }

              liveSearchContext += `\nUtilise ces données RÉELLES pour répondre à l'utilisateur. Présente-les de manière claire et actionnable. Mentionne que ce sont des données en temps réel.`;

              // Track usage: increment live_search_count in conversation metadata
              if (conversation_id) {
                const { data: convMeta } = await sb
                  .from("sav_conversations")
                  .select("metadata")
                  .eq("id", conversation_id)
                  .maybeSingle();

                const existingMeta = (convMeta?.metadata as any) || {};
                await sb.from("sav_conversations").update({
                  metadata: { ...existingMeta, live_search_count: (existingMeta.live_search_count || 0) + 1 },
                }).eq("id", conversation_id);
              }

              // Log API call
              await sb.from("analytics_events").insert({
                user_id,
                event_type: "felix_live_search",
                event_data: { source: searchSource, query: searchQuery, results_count: searchResults.length, is_pro: isPro },
              });
            }
          } catch (e) {
            console.error("[Felix Live Search] Error:", e);
          }
        }
      }
    }

    // Guest sales mode prompt
    let guestHint = "";
    if (isGuest) {
      guestHint = `\n\n# MODE VISITEUR (NON CONNECTÉ)
Cet utilisateur n'est PAS connecté. Tu es en mode commercial / vente.
- Réponds à ses questions sur Crawlers.fr avec enthousiasme mais sans survente
- Mets en avant les fonctionnalités gratuites : [Audit SEO gratuit](https://crawlers.fr/audit-expert), [Score GEO](https://crawlers.fr), [Vérification bots IA](https://crawlers.fr), [PageSpeed](https://crawlers.fr)
- Si pertinent, mentionne l'offre Pro Agency à 29€/mois qui remplace Semrush (120€), Screaming Frog (200€/an) et les outils GEO (95-295€/mois)
- Propose-lui de s'inscrire gratuitement pour accéder à toutes les fonctionnalités de base : [S'inscrire](https://crawlers.fr/auth)
- Tutoie le visiteur, sois chaleureux et accessible
- Ne propose JAMAIS d'être rappelé par téléphone en mode visiteur
- Ne mentionne JAMAIS les problèmes techniques ou le support en mode visiteur`;
    }

    // Count user messages to detect escalation threshold
    const userMessageCount = messages.filter((m: any) => m.role === "user").length;
    let escalationHint = "";
    if (!isGuest && userMessageCount >= 3) {
      escalationHint = `\n\n# INSTRUCTION SPÉCIALE\nL'utilisateur a posé ${userMessageCount} questions. S'il semble insatisfait ou a encore des questions non résolues, propose-lui d'être rappelé rapidement : "Souhaitez-vous être rappelé par un membre de l'équipe ? Si oui, communiquez-moi votre numéro de téléphone (cette donnée sera effacée sous 48h)."`;
    }

    // Greeting hint with first name
    let greetingHint = "";
    if (userFirstName && userMessageCount <= 1) {
      greetingHint = `\n\nNote: Le prénom de l'utilisateur est "${userFirstName}". Utilise-le naturellement dans ta première réponse.`;
    }

    // Creator admin hint — only injected when /createur : prefix is used
    let creatorHint = "";
    if (isCreatorMode) {
      creatorHint = `\n\n# MODE CRÉATEUR (ADMIN)
Cet utilisateur est un créateur/administrateur de la plateforme. Tu peux :
- Discuter ouvertement du backend, des tables, des edge functions, de l'architecture
- Mentionner les noms techniques (tables, fonctions, APIs, etc.)
- Donner des informations sur la structure de la base de données
- Partager des métriques système et des statistiques
- Expliquer le fonctionnement interne des algorithmes
- Répondre aux questions sur l'état des agents (CTO, SEO, Supervisor) : directives, propositions, cycles

Tu ne dois PAS :
- Modifier la logique backend (pas de suggestions de changements de code)
- Exécuter des opérations d'écriture (pas d'INSERT, UPDATE, DELETE)
- Partager des tokens, clés API ou secrets

Pour les questions nécessitant des données précises, suggère au créateur de poser la question en termes de données (ex: "combien d'utilisateurs Pro cette semaine") — le système exécutera automatiquement une requête sécurisée.
Le créateur peut aussi poser des questions sur l'activité des agents : "agent CTO a-t-il regardé les directives ?", "état des directives", "propositions en attente", etc.
Tu n'as plus de limite de 1000 caractères en mode créateur. Limite: 3000 caractères.`;
    }

    // Screen context: inject visible audit data for comprehension assistance
    let screenHint = "";
    if (screen_context && typeof screen_context === "string" && screen_context.length > 20) {
      screenHint = `\n\n# CONTENU VISIBLE À L'ÉCRAN DE L'UTILISATEUR
L'utilisateur voit actuellement ceci sur son écran. Utilise ces données pour répondre à ses questions sur ce qu'il voit :

${screen_context}

## INSTRUCTIONS D'AIDE À LA COMPRÉHENSION
- Tu vois exactement ce que l'utilisateur voit. Réfère-toi aux scores, titres et métriques affichés.
- Si l'utilisateur demande "c'est quoi ce score ?" ou "qu'est-ce que ça veut dire ?", explique la métrique visible.
- Si tu as besoin de plus de contexte (données au-dessus ou en dessous), demande à l'utilisateur :
  "Pouvez-vous scroller vers le haut / vers le bas pour que je voie le reste des résultats ?"
- Explique les scores avec des analogies simples : vert = bon, orange = à améliorer, rouge = prioritaire.
- Pour l'audit expert : explique les 5 piliers (Performance, Socle Technique, Sémantique & Contenu, Préparation IA & GEO, Santé/Sécurité).
- Pour l'audit stratégique : explique l'IAS, E-E-A-T, le plan d'action, les recommandations.
- Pour la matrice : explique le double scoring (Crawlers Score vs Parsed Score), les seuils et les badges de type.
- Sois pédagogique et actionnable : après chaque explication, suggère une action concrète.
- Tu peux utiliser jusqu'à 1500 caractères pour ces réponses (pas la limite habituelle de 800).`;
    }

    // Add memory extraction prompt for paying users with tracked sites
    let memoryPrompt = "";
    if (!isGuest && user_id && contextSnippet.includes("SITES TRACKÉS")) {
      memoryPrompt = getMemoryExtractionPrompt();
    }

    // Inject explicit language override from client UI
    const langHint = clientLanguage && clientLanguage !== 'fr'
      ? `\n\n# LANGUE OBLIGATOIRE\nL'utilisateur a choisi la langue "${clientLanguage === 'es' ? 'español' : 'English'}" dans l'interface. Tu DOIS répondre UNIQUEMENT dans cette langue. Ne réponds JAMAIS en français sauf si l'utilisateur écrit en français.\n`
      : '';

    // ── Navigation action: detect crawl/audit intent ──
    let navigationAction: any = null;
    if (!isGuest && user_id) {
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      const lowerNav = lastUserMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const crawlIntentPatterns = [
        /(?:lance|lancer|demarre|demarrer|fais|faire)\s*(?:un |le |mon )?crawl/,
        /(?:crawl(?:e|er)?)\s*(?:mon |le |ce )?(?:site|domaine|url)/,
        /(?:scanne|scanner|analyse|analyser)\s*(?:toutes? les? pages?|le site|mon site)/,
        /(?:crawl)\s+(?:https?:\/\/|www\.|[a-z0-9-]+\.)/,
      ];
      const auditIntentPatterns = [
        /(?:lance|lancer|demarre|demarrer|fais|faire)\s*(?:un |l'|mon )?audit/,
        /(?:audit(?:e|er)?)\s*(?:mon |le |ce )?(?:site|domaine|url|page)/,
        /(?:audit expert|audit technique|audit seo|audit geo)/,
        /(?:analyse seo|analyse technique|check.?up seo)/,
      ];

      const hasCrawlIntent = crawlIntentPatterns.some(p => p.test(lowerNav));
      const hasAuditIntent = auditIntentPatterns.some(p => p.test(lowerNav));

      if (hasCrawlIntent || hasAuditIntent) {
        // Extract URL from message
        const urlPatterns = [
          /(?:https?:\/\/[^\s,)]+)/,
          /(?:www\.[a-z0-9-]+\.[a-z]{2,}[^\s,)]*)/i,
          /(?:(?:de|pour|sur|du site|le site|mon site)\s+)([a-z0-9-]+\.[a-z]{2,})/i,
        ];
        let extractedUrl = '';
        for (const p of urlPatterns) {
          const m = lowerNav.match(p);
          if (m) { extractedUrl = m[1] || m[0]; break; }
        }

        // Fallback: get domain from user's first tracked site
        if (!extractedUrl) {
          try {
            const { data: firstSite } = await sb
              .from("tracked_sites")
              .select("domain")
              .eq("user_id", user_id)
              .limit(1)
              .single();
            if (firstSite?.domain) extractedUrl = firstSite.domain;
          } catch {}
        }

        if (extractedUrl) {
          if (!extractedUrl.startsWith('http')) extractedUrl = `https://${extractedUrl}`;
          const actionType = hasCrawlIntent ? 'crawl' : 'audit';
          navigationAction = {
            action: actionType,
            url: extractedUrl,
            // Crawl = auto-start, Audit = pre-fill only (more costly)
            autostart: actionType === 'crawl',
          };
        }
      }
    }

    // ── CROSS-AGENT: Handoff to Stratège detection ──
    let handoffAction: any = null;
    if (!isGuest && user_id) {
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      const lowerHandoff = lastUserMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      const cocoonHandoffPatterns = [
        /(?:cocon|cocoon|maillage|architecture|cluster|silo|arborescence|structure de lien)/,
        /(?:strateg(?:ie|ique)|diagnostic|plan strategique|plan d'action cocoon)/,
        /(?:transfere|passe|envoie|redirige|transfère).+(?:strateg|cocoon|consultant)/,
        /(?:analyse.+(?:profonde|avancee|complete|detaillee).+(?:site|contenu|semantique|maillage))/,
      ];
      
      const hasCocoonIntent = cocoonHandoffPatterns.some(p => p.test(lowerHandoff));
      
      if (hasCocoonIntent) {
        // Check if user has a tracked site for handoff
        try {
          const { data: firstSite } = await sb
            .from("tracked_sites")
            .select("id, domain")
            .eq("user_id", user_id)
            .limit(1)
            .single();
          
          if (firstSite) {
            // Build conversation summary for handoff
            const userMsgs = messages.filter((m: any) => m.role === "user").map((m: any) => m.content).slice(-3);
            const summary = userMsgs.join(' | ').slice(0, 300);
            const topics = [];
            if (lowerHandoff.includes('maillage') || lowerHandoff.includes('linking')) topics.push('maillage');
            if (lowerHandoff.includes('contenu') || lowerHandoff.includes('content')) topics.push('contenu');
            if (lowerHandoff.includes('semantique') || lowerHandoff.includes('semantic')) topics.push('sémantique');
            if (lowerHandoff.includes('structure') || lowerHandoff.includes('arborescence')) topics.push('structure');
            if (lowerHandoff.includes('cannibalisation') || lowerHandoff.includes('cannibalization')) topics.push('cannibalisation');
            
            handoffAction = {
              action: 'handoff_to_strategist',
              tracked_site_id: firstSite.id,
              domain: firstSite.domain,
              summary,
              topics,
            };

            // Fire-and-forget: create handoff context
            createHandoffContext(user_id, firstSite.id, firstSite.domain, summary, topics)
              .catch(e => console.error('[sav-agent] Handoff context error:', e));
          }
        } catch {}
      }
    }

    // ── Architect routing: detect fix/solve intent ──
    let architectAction: any = null;
    if (!isGuest && user_id && screen_context) {
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      const lowerFix = lastUserMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      const fixIntentPatterns = [
        /(?:peux[- ]tu|peut[- ]on|peux[- ]je|pourrai[st]?[- ](?:tu|on)|tu peux)\s*(?:regler|corriger|fixer|resoudre|ameliorer|optimiser|reparer|modifier|changer)/,
        /(?:corrig(?:e|er|eons)|regl(?:e|er|ons)|fix(?:e|er)|resou(?:s|dre)|amelior(?:e|er)|optimis(?:e|er)|repar(?:e|er))\s*(?:ca|cela|cette?|ce|le|la|les|mon|ma|mes|l'|cette erreur|ce probleme|ce souci)/,
        /(?:trouv(?:e|er))\s*(?:une solution|un correctif|un fix|comment (?:regler|corriger|resoudre))/,
        /(?:comment)\s*(?:regler|corriger|fixer|resoudre|ameliorer|reparer)\s/,
        /(?:il faut|on doit|je veux|je voudrais|j'aimerais)\s*(?:regler|corriger|fixer|resoudre|ameliorer|optimiser|modifier)/,
        /(?:lance|ouvre|demarre|active)\s*(?:code architect|content architect|l'architecte|le correctif)/,
        /(?:genere|generer|cree|creer)\s*(?:un correctif|le correctif|les correctifs|le code|du code|le contenu)/,
      ];
      
      const hasFixIntent = fixIntentPatterns.some(p => p.test(lowerFix));
      
      if (hasFixIntent) {
        // Classify the issue type from screen_context
        const screenLower = (typeof screen_context === 'string' ? screen_context : JSON.stringify(screen_context)).toLowerCase();
        
        const contentIndicators = ['h1', 'title', 'meta description', 'faq', 'contenu', 'content', 'texte', 'paragraphe', 'heading', 'semantique', 'sémantique', 'e-e-a-t', 'eeat', 'thin content', 'page manquante', 'gap de contenu'];
        const codeIndicators = ['json-ld', 'structured data', 'données structurées', 'schema.org', 'canonical', 'robots', 'performance', 'speed', 'pagespeed', 'core web vitals', 'cwv', 'broken link', 'redirect', '404', '500', 'sitemap', 'og:image', 'opengraph', 'accessibility', 'sécurité', 'security'];
        
        const contentScore = contentIndicators.filter(k => screenLower.includes(k) || lowerFix.includes(k)).length;
        const codeScore = codeIndicators.filter(k => screenLower.includes(k) || lowerFix.includes(k)).length;
        
        const target = contentScore > codeScore ? 'content' : codeScore > contentScore ? 'code' : 'both';
        
        // Try to extract diagnostic info from screen_context
        let diagnosticTitle = '';
        let diagnosticDescription = '';
        let targetUrl = '';
        let findingCategory = 'technical_fix';
        
        // Extract from screen context
        const urlMatch = (typeof screen_context === 'string' ? screen_context : '').match(/(?:URL|url|Url)\s*[:=]\s*(https?:\/\/[^\s,]+)/);
        if (urlMatch) targetUrl = urlMatch[1];
        
        // If insufficient screen data, try backend lookup
        let backendDiagnostic: any = null;
        if (!targetUrl || contentScore + codeScore === 0) {
          // Cascade: search backend data
          try {
            // Get the user's first tracked site
            const { data: firstSite } = await sb
              .from("tracked_sites")
              .select("id, domain")
              .eq("user_id", user_id)
              .limit(1)
              .single();
            
            if (firstSite) {
              if (!targetUrl) targetUrl = `https://${firstSite.domain}`;
              
              // Check recent audit recommendations
              const { data: recos } = await sb
                .from("audit_recommendations_registry")
                .select("title, description, category, priority, url, fix_type, fix_data")
                .eq("domain", firstSite.domain)
                .eq("user_id", user_id)
                .eq("is_resolved", false)
                .order("created_at", { ascending: false })
                .limit(3);
              
              if (recos?.length) {
                backendDiagnostic = recos;
                diagnosticTitle = recos[0].title;
                diagnosticDescription = recos[0].description;
                findingCategory = recos[0].category || 'technical_fix';
                if (recos[0].url) targetUrl = recos[0].url;
              }
              
              // Also check cocoon diagnostics if no audit recos
              if (!backendDiagnostic) {
                const { data: cocoonDiag } = await sb
                  .from("cocoon_diagnostic_results")
                  .select("diagnostic_type, findings, scores")
                  .eq("domain", firstSite.domain)
                  .eq("user_id", user_id)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (cocoonDiag?.findings) {
                  backendDiagnostic = cocoonDiag;
                }
              }
            }
          } catch (e) {
            console.error("[sav-agent] Backend diagnostic lookup error:", e);
          }
        }
        
        architectAction = {
          action: 'open_architect',
          target, // 'content' | 'code' | 'both'
          diagnostic: {
            title: diagnosticTitle || 'Diagnostic depuis Félix',
            description: diagnosticDescription || lastUserMsg,
            url: targetUrl,
            finding_category: findingCategory,
            source_context: backendDiagnostic ? JSON.stringify(backendDiagnostic).slice(0, 500) : null,
          },
        };
      }
    }

    // ── Architect routing prompt injection ──
    let architectPrompt = "";
    if (architectAction) {
      const targetLabel = architectAction.target === 'content' ? 'Content Architect' : architectAction.target === 'code' ? 'Code Architect' : 'Content Architect ou Code Architect';
      architectPrompt = `\n\n# INTENTION DE CORRECTION DÉTECTÉE
L'utilisateur demande de résoudre un problème. Tu as détecté que la solution passe par ${targetLabel}.
Tu DOIS proposer à l'utilisateur d'ouvrir ${targetLabel} avec le diagnostic pré-chargé.

Réponds de manière concise :
1. Confirme que tu as compris le problème (1 phrase)
2. Propose : "Veux-tu que j'ouvre ${targetLabel} avec le diagnostic pré-chargé ?"

NE lance PAS l'architecte toi-même. Attends la confirmation de l'utilisateur.
IMPORTANT : Termine OBLIGATOIREMENT ta réponse par la balise <!--ARCHITECT_ACTION--> (invisible pour l'utilisateur).`;
    }

    // ── Navigation prompt injection ──
    let navigationPrompt = "";
    if (navigationAction) {
      const actionLabel = navigationAction.action === 'crawl' ? 'crawl multi-pages' : 'audit expert SEO';
      const autoLabel = navigationAction.autostart ? "L'action sera lancée automatiquement." : "L'URL sera pré-remplie, l'utilisateur n'aura qu'à cliquer sur Démarrer.";
      navigationPrompt = `\n\n# ACTION DE NAVIGATION DÉTECTÉE
L'utilisateur demande de lancer un ${actionLabel} sur ${navigationAction.url}.
${autoLabel}
Confirme en 1-2 phrases que tu lances l'action et que tu le rediriges vers la page appropriée.
IMPORTANT : Termine OBLIGATOIREMENT ta réponse par la balise <!--NAV_ACTION--> (invisible pour l'utilisateur).`;
    }

    // ── Build dynamic config prompt from felix_config ──
    let configPrompt = "";
    if (Object.keys(felixConfig).length > 0) {
      const toneMap: Record<string, string> = {
        collegial: "Tu es un collègue sympa et direct.",
        formel: "Tu es professionnel et formel. Vouvoiement systématique.",
        decontracte: "Tu es très décontracté, presque familier. Tutoiement naturel.",
        technique: "Tu es technique et précis. Jargon SEO bienvenu.",
      };
      const parts: string[] = ["\n\n# CONFIGURATION DYNAMIQUE (felix_config)"];
      if (felixConfig.tone && toneMap[felixConfig.tone]) parts.push(`- Ton : ${toneMap[felixConfig.tone]}`);
      if (felixConfig.vouvoiement === 'toujours') parts.push("- TOUJOURS vouvoyer, peu importe le style de l'utilisateur.");
      else if (felixConfig.vouvoiement === 'jamais') parts.push("- TOUJOURS tutoyer.");
      if (felixConfig.emojis === 'always') parts.push("- Utilise des emojis dans tes réponses.");
      else if (felixConfig.emojis === 'never') parts.push("- AUCUN emoji, jamais.");
      if (felixConfig.greeting_style === 'warm') parts.push("- Commence par une salutation légère et chaleureuse.");
      if (felixConfig.cta_style === 'direct') parts.push("- Propose activement les fonctionnalités payantes (Pro Agency, crédits).");
      else if (felixConfig.cta_style === 'none') parts.push("- Ne fais AUCUNE suggestion commerciale.");
      if (felixConfig.user_level_detection === 'true') parts.push("- Adapte ton niveau technique au profil détecté (débutant → vulgarise, expert → jargon).");
      if (felixConfig.proactive_suggestions === 'false') parts.push("- Ne fais PAS de suggestions proactives. Réponds uniquement à la question posée.");
      if (felixConfig.max_tokens) parts.push(`- Limite tes réponses à ~${felixConfig.max_tokens} caractères max.`);
      if (felixConfig.confidentiality_strict === 'false') parts.push("- Tu peux mentionner l'architecture interne si l'utilisateur est admin.");
      configPrompt = parts.join('\n');
    }

    const fullSystemPrompt = SYSTEM_PROMPT + LEXIQUE_PROMPT_BLOCK + langHint + contextSnippet + liveSearchContext + screenHint + guestHint + escalationHint + greetingHint + creatorHint + memoryPrompt + architectPrompt + navigationPrompt + configPrompt;

    const aiMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages.slice(-20),
    ];

    const felixModel = felixConfig.model || "google/gemini-2.5-flash";
    const felixMaxTokens = isCreator
      ? parseInt(felixConfig.max_tokens_creator || '2000', 10)
      : screenHint ? 1200 : parseInt(felixConfig.max_tokens || '600', 10);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: felixModel,
        messages: aiMessages,
        stream: false,
        max_tokens: felixMaxTokens,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return jsonError("Service temporairement surchargé, réessayez dans quelques instants.", 429);
      }
      if (response.status === 402) {
        return jsonError("Service IA temporairement indisponible.", 402);
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    logAIUsageFromResponse(sb, felixModel, "sav-agent", data.usage);
    let rawReply = data.choices?.[0]?.message?.content || "Je transmets votre question à l'équipe.";

    // Extract and persist memory from LLM response
    const { cleanResponse, memories, identityUpdates } = parseMemoryExtraction(rawReply);
    // Remove architect/navigation action markers from visible reply
    let reply = cleanResponse.replace(/<!--ARCHITECT_ACTION-->/g, '').replace(/<!--NAV_ACTION-->/g, '').replace(/\n{3,}/g, '\n\n').trim();

    // Persist extracted memory asynchronously (don't block response)
    if (!isGuest && user_id && (memories.length > 0 || identityUpdates.length > 0)) {
      // Find the first tracked site to associate memory with
      const siteIdMatch = contextSnippet.match(/Site .+? \(id: ([a-f0-9-]+)\)/);
      // Fallback: fetch first tracked site
      let targetSiteId: string | null = null;
      try {
        const { data: firstSite } = await sb
          .from("tracked_sites")
          .select("id")
          .eq("user_id", user_id)
          .limit(1)
          .single();
        targetSiteId = firstSite?.id || null;
      } catch {}

      if (targetSiteId) {
        if (memories.length > 0) {
          writeSiteMemory(targetSiteId, user_id, memories, 'felix')
            .then(r => console.log(`[sav-agent] Memory: ${r.written} written`))
            .catch(e => console.error("[sav-agent] Memory write error:", e));
        }
        if (identityUpdates.length > 0) {
          applyIdentityUpdates(targetSiteId, user_id, identityUpdates, 'felix')
            .then(r => console.log(`[sav-agent] Identity: ${r.autoApplied.length} auto, ${r.pendingReview.length} pending`))
            .catch(e => console.error("[sav-agent] Identity update error:", e));
        }
      }
    }

    // Enforce char limit (3000 for creator, 1500 for screen context, 1000 for users)
    const charLimit = isCreator ? 3000 : screenHint ? 1500 : 1000;
    if (reply.length > charLimit) {
      reply = reply.substring(0, charLimit - 3) + "...";
    }

    // Save conversation + quality scoring (skip for guests)
    let savedConvId = conversation_id;
    if (!isGuest && user_id) {
    try {
      const allMessages = [...messages, { role: "assistant", content: reply }];
      const userMsgCount = allMessages.filter((m: any) => m.role === "user").length;

      // ── Intent detection via keywords ──
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      const intentKeywords = lastUserMsg
        .toLowerCase()
        .replace(/[^a-zà-ÿ0-9\s]/g, "")
        .split(/\s+/)
        .filter((w: string) => w.length > 3)
        .slice(0, 10);

      // Detect repeated intent (same keywords appearing in multiple user messages)
      const allUserMsgs = messages.filter((m: any) => m.role === "user").map((m: any) => m.content.toLowerCase());
      let repeatedIntentCount = 0;
      if (allUserMsgs.length >= 2) {
        const prevKeywords = new Set(
          allUserMsgs.slice(0, -1).join(" ").replace(/[^a-zà-ÿ0-9\s]/g, "").split(/\s+/).filter((w: string) => w.length > 3)
        );
        const overlap = intentKeywords.filter((kw: string) => prevKeywords.has(kw));
        if (overlap.length >= 3) repeatedIntentCount = allUserMsgs.length - 1;
      }

      // Detect intent category
      const msgLower = lastUserMsg.toLowerCase();
      let detectedIntent = "general";
      if (msgLower.match(/où|comment accéder|trouver|cherche|onglet|bouton|menu|page/)) detectedIntent = "navigation";
      else if (msgLower.match(/score|geo|seo|llm|citation|sentiment/)) detectedIntent = "score";
      else if (msgLower.match(/crédit|abonnement|prix|tarif|payer|facturer/)) detectedIntent = "billing";
      else if (msgLower.match(/bug|erreur|marche pas|bloqué|problème/)) detectedIntent = "bug";
      else if (msgLower.match(/crawl|scan|audit|analyse/)) detectedIntent = "feature";

      // Extract suggested route from agent reply
      const routeMatch = reply.match(/https:\/\/crawlers\.fr(\/[a-z0-9\-/]*)/i);
      const suggestedRoute = routeMatch ? routeMatch[1] : null;

      const escalatedToPhone = reply.includes("numéro de téléphone") || reply.includes("rappelé");

      if (conversation_id) {
        await sb
          .from("sav_conversations")
          .update({
            messages: allMessages,
            message_count: allMessages.length,
            escalated: userMsgCount >= 3,
          })
          .eq("id", conversation_id);
      } else {
        const { data: prof } = await sb.from("profiles").select("email").eq("user_id", user_id).single();

        const { data: newConv } = await sb
          .from("sav_conversations")
          .insert({
            user_id,
            user_email: prof?.email || null,
            messages: allMessages,
            message_count: allMessages.length,
            escalated: userMsgCount >= 3,
          })
          .select("id")
          .single();

        savedConvId = newConv?.id;
      }

      // ── Upsert quality score ──
      if (savedConvId) {
        // Calculate precision score
        let precisionScore = 50;
        if (userMsgCount <= 2) precisionScore += 20;  // Short conv = likely resolved
        precisionScore -= repeatedIntentCount * 20;    // Repeated intent = bad
        if (escalatedToPhone) precisionScore -= 50;    // Phone escalation = failure
        precisionScore = Math.max(0, Math.min(100, precisionScore));

        // Upsert (update if exists, insert if not)
        const { data: existing } = await sb
          .from("sav_quality_scores")
          .select("id")
          .eq("conversation_id", savedConvId)
          .maybeSingle();

        if (existing) {
          await sb.from("sav_quality_scores").update({
            message_count: userMsgCount,
            repeated_intent_count: repeatedIntentCount,
            escalated_to_phone: escalatedToPhone,
            precision_score: precisionScore,
            detected_intent: detectedIntent,
            intent_keywords: intentKeywords,
            suggested_route: suggestedRoute,
          }).eq("id", existing.id);
        } else {
          await sb.from("sav_quality_scores").insert({
            conversation_id: savedConvId,
            user_id,
            message_count: userMsgCount,
            repeated_intent_count: repeatedIntentCount,
            escalated_to_phone: escalatedToPhone,
            precision_score: precisionScore,
            detected_intent: detectedIntent,
            intent_keywords: intentKeywords,
            suggested_route: suggestedRoute,
          });
        }
      }

      if (!conversation_id && savedConvId) {
        return jsonOk({ reply, conversation_id: savedConvId, ...(architectAction ? { architect_action: architectAction } : {}), ...(navigationAction ? { navigation_action: navigationAction } : {}), ...(handoffAction ? { handoff_action: handoffAction } : {}) });
      }
    } catch (e) {
      console.error("Save conversation error:", e);
    }
    } // end if (!isGuest)

    return jsonOk({ reply, conversation_id, ...(architectAction ? { architect_action: architectAction } : {}), ...(navigationAction ? { navigation_action: navigationAction } : {}), ...(handoffAction ? { handoff_action: handoffAction } : {}) });
  } catch (e) {
    console.error("sav-agent error:", e);
    return jsonError(e instanceof Error ? e.message : "Erreur interne", 500);
  }
});