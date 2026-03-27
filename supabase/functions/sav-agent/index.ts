import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabaseClient.ts";
import { readSiteMemory, writeSiteMemory, applyIdentityUpdates, getMemoryExtractionPrompt, parseMemoryExtraction, getPendingSuggestions } from "../_shared/siteMemory.ts";
import { FELIX_PERSONA, getAutonomyBlock, INTENTIONALITY_PROMPT } from "../_shared/agentPersonas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
- CMS Connectées → WordPress, Drupal, IKTracker, Shopify, WooCommerce

## Pages d'audit
- /audit-expert → audit SEO gratuit 200 points (1/jour freemium, illimité Pro)
- /audit-compare → benchmark vs 3 concurrents (4 crédits)
- /matrice → matrice d'audit (moteur d'audit sur-mesure multi-critères)

## Pages outils
- /site-crawl → crawl multi-pages (jusqu'à 5000 pages, Pro Agency)
- /cocoon → cocon sémantique 3D (Three.js, TF-IDF, chat IA intégré)
- /architecte-generatif → Code Architect (métadonnées, JSON-LD, données structurées)

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

# LONGUEUR DES RÉPONSES
- MAXIMUM 600 caractères par défaut. Relis et coupe avant d'envoyer.
- Si tu dépasses, résume et propose "Je détaille si tu veux."
- Vouvoiement par défaut. Si l'utilisateur tutoie, tu peux tutoyer aussi.
- Pas d'emojis sauf si l'utilisateur en utilise.

# CONFIDENTIALITÉ TECHNIQUE (CRITIQUE)
- NE MENTIONNE JAMAIS les technologies internes (Supabase, Deno, Lovable, Edge Functions, Row-Level Security, PostgreSQL, Deno.serve)
- NE DONNE JAMAIS d'information sur l'architecture technique interne, les noms de tables, les noms de fonctions, les endpoints API
- NE MENTIONNE JAMAIS les noms des modules internes : "cocoon-strategist", "cocoon-diag-content", "cocoon-diag-semantic", "cocoon-diag-structure", "cocoon-diag-authority", "content-architecture-advisor", "persist-cocoon-session", "getDomainContext", "resolveGoogleToken", etc.
- Quand tu parles des algorithmes, dis : "nos algorithmes propriétaires", "notre moteur d'analyse", "nos systèmes d'optimisation"
- Quand tu parles du diagnostic stratégique, dis : "l'assistant Cocoon analyse votre site avec plusieurs algorithmes maison pour détecter les problèmes et proposer des solutions"
- Si l'utilisateur demande des détails techniques sur le fonctionnement, reste vague et professionnel : "Nous combinons analyse sémantique, crawl technique et données de performance dans un pipeline multi-étapes propriétaire."

# NAVIGATION FRONTEND
Tu connais PARFAITEMENT la navigation de Crawlers.fr. Quand l'utilisateur demande "où est..." ou "comment accéder à...", donne-lui le chemin EXACT et un lien direct.
${FRONTEND_TAXONOMY}

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
- [Audit Expert SEO](https://crawlers.fr/audit-expert) : 200 points. 1/jour gratuit inscrit, illimité Pro Agency.
- Audit Stratégique IA : scoring IAS + E-E-A-T + plan d'action. 1 crédit.
- [Audit Comparé](https://crawlers.fr/audit-compare) : benchmark vs 3 concurrents. 4 crédits.
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
  - Consultation et réponse aux avis Google (note moyenne, tendance)
  - Publication de Google Posts (actualités, offres, événements)
  - Tableau de bord performances locales (vues, clics, appels, itinéraires)
  - Données intégrées à l'Audit Local SEO pour des recommandations personnalisées
  - Informations fiche (nom, adresse, catégorie, horaires)
- **Langues** : interface trilingue FR/EN/ES.
- **Prérequis** : abonnement Pro Agency actif et compte Google propriétaire de la fiche.
- **Problèmes fréquents** : si la fiche n'apparaît pas, vérifier que le compte Google utilisé est bien propriétaire/gestionnaire de l'établissement dans Google Business Profile.
- Agents autonomes : Agent SEO + Agent CTO.

## Stratégie 360° (via le Cocon Sémantique)
L'assistant Cocoon intègre un mode **Stratégie 360°** (bouton boussole dans le chat Cocoon). Ce mode lance automatiquement :
1. **Diagnostic multi-axes** : contenu (pages minces, doublons), sémantique (gaps de mots-clés, cohérence title/ancres), structure (pages profondes, orphelines, redirections), autorité (backlinks, domaine rank)
2. **Plan d'action priorisé** : jusqu'à 8 tâches classées par impact, urgence et faisabilité
3. **3 axes de développement** : l'utilisateur choisit parmi 3 directions stratégiques (autorité éditoriale, performance technique, architecture sémantique, croissance off-site, ou optimisation des conversions)
4. **Boucle rétro-active** : les recommandations passées sont réévaluées avec les données GSC/GA4 pour mesurer leur impact réel

L'assistant Cocoon présente tout cela de manière conversationnelle. Les tâches validées se retrouvent dans [Console](https://crawlers.fr/console) > Plans d'Action.

## Content Architect (fonctionnalité avancée, Admin)
Accessible via Code Architect > onglet "Contenu", le Content Architect génère des contenus pré-configurés selon les recommandations de la stratégie 360°. Il propose :
- Type de contenu, longueur, mots-clés cibles
- Structure éditoriale (résumé, tableau LLM, FAQ, sources, CTA)
- Calendrier éditorial (Admin uniquement)
- **Publication CMS** : Les contenus générés peuvent être publiés directement en brouillon sur le CMS du client (WordPress, Shopify, Drupal, Odoo, PrestaShop, IKtracker). Supporte la création d'**articles** ET de **pages statiques** selon le CMS.
- **Limites mensuelles** : 5 contenus/mois (Free), 100 contenus/mois (Pro Agency), 200 contenus/mois (Pro Agency+). Renouvellement automatique le 1er du mois.

## Crédits & Abonnement
- 25 crédits offerts à l'inscription.
- Freemium : bots IA, GEO Score, LLM, PageSpeed gratuits. Audit SEO 1/jour.
- Pro Agency : 59€/mois garanti à vie pour les 100 premiers. 5 000 pages de crawl/mois, 10 pages/scan. Détails sur [la page tarifs](https://crawlers.fr/tarifs).
- Pro Agency + : 89€/mois. 50 000 pages de crawl/mois, 50 pages/scan. Pour les agences et structures avec 10+ clients. Détails sur [la page Pro Agency](https://crawlers.fr/pro-agency).
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
"C'est trop cher" → Pro Agency 59€ remplace Semrush (120€) + Screaming Frog (200€/an) + outils GEO (95-295€). Garanti à vie pour les 100 premiers. Pro Agency+ à 89€ pour les agences avec gros volumes de crawl (50 000 pages/mois).
"Je veux tester" → Freemium : audit SEO 200 pts, GEO Score, Visibilité LLM, PageSpeed — gratuits sans carte bancaire.
"Pourquoi pas Semrush ?" → Semrush = SEO classique. Crawlers.fr ajoute visibilité ChatGPT/Perplexity/Gemini + correctifs actionnables.
"Pro Agency ou Pro Agency+ ?" → Pro Agency (59€) = indépendants et petites agences (1-5 clients). Pro Agency+ (89€) = agences avec 10+ clients, gros volumes de crawl (50k pages/mois vs 5k).

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();

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
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, conversation_id, user_id, guest_mode, screen_context } = body;
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isGuest = guest_mode === true || !user_id;

    const sb = getServiceClient();

    // ── Check if user is admin (creator) ──
    let isCreator = false;
    if (!isGuest && user_id) {
      const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user_id, _role: "admin" });
      isCreator = isAdmin === true;
    }

    // ── Detect backend query intent from creator ──
    if (isCreator) {
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      
      // ── Parménion intent detection ──
      const parmenionKeywords = [
        "parménion", "parmenion", "autopilot", "autopilote",
        "que fait-il", "qu'est-ce qu'il fait", "qu'a-t-il fait",
        "cycle en cours", "dernier cycle", "prochain cycle",
        "diagnostic autopilot", "observations autopilot",
      ];
      const lowerMsgCheck = lastUserMsg.toLowerCase();
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

            return new Response(JSON.stringify({ reply, conversation_id: savedConvId || conversation_id }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          console.error("Parmenion context fetch error:", e);
          // Fall through to normal flow
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

              return new Response(JSON.stringify({ reply: adminReply, conversation_id: savedConvId || conversation_id }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        } catch (e) {
          console.error("Admin backend query error:", e);
          // Fall through to normal SAV agent
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
            alertBlock += `Suggère de passer au plan Pro Agency (59€/mois) pour bénéficier de l'Audit Expert et du Code Correctif illimités + 5000 pages de crawl. Lien : [Voir Pro Agency](https://crawlers.fr/pro-agency)`;
          } else {
            alertBlock += `Suggère de recharger avec un pack de crédits (Premium : 150 crédits à 45€) depuis [Mon Portefeuille](https://crawlers.fr/console) > onglet Pro Agency.`;
          }
        } else if (userCredits <= 3) {
          alertBlock += `\n⚠️ ALERTE CRÉDITS BAS : Il ne reste que ${userCredits} crédit(s). `;
          if (userPlan === 'free') {
            alertBlock += `Mentionne que le plan Pro Agency (59€/mois) offre l'Audit Expert et le Code Correctif illimités. [Voir Pro Agency](https://crawlers.fr/pro-agency)`;
          } else {
            alertBlock += `Propose de recharger avec le Pack Premium (150 crédits à 45€) depuis l'onglet Pro Agency dans la Console.`;
          }
        }

        // Crawl alerts
        if (crawlUsagePercent >= 100) {
          alertBlock += `\n⚠️ ALERTE CRAWL PLAFOND ATTEINT : ${totalCrawledPages}/${maxCrawlPages} pages crawlées ce mois (${crawlUsagePercent}%). `;
          if (userPlan === 'agency_pro') {
            alertBlock += `Suggère de passer à Pro Agency + (89€/mois) pour 50 000 pages/mois et 50 pages/scan. [Voir Pro Agency +](https://crawlers.fr/pro-agency)`;
          } else if (userPlan === 'free') {
            alertBlock += `Suggère Pro Agency (59€/mois) pour 5 000 pages/mois. [Voir Pro Agency](https://crawlers.fr/pro-agency)`;
          }
        } else if (crawlUsagePercent >= 80) {
          alertBlock += `\n⚠️ ALERTE CRAWL PROCHE DU PLAFOND : ${totalCrawledPages}/${maxCrawlPages} pages crawlées ce mois (${crawlUsagePercent}%). `;
          if (userPlan === 'agency_pro') {
            alertBlock += `Informe que Pro Agency + (89€/mois) offre 50 000 pages/mois si besoin. [Voir Pro Agency +](https://crawlers.fr/pro-agency)`;
          } else if (userPlan === 'free') {
            alertBlock += `Suggère Pro Agency (59€/mois) pour 5 000 pages/mois. [Voir Pro Agency](https://crawlers.fr/pro-agency)`;
          }
        }

        if (alertBlock) {
          contextSnippet += `\n# ALERTES PROACTIVES — MENTIONNER NATURELLEMENT DANS LA RÉPONSE
Ces alertes doivent être intégrées naturellement dans ta réponse. Ne les ignore pas. Intègre l'information de façon fluide, pas comme un bandeau publicitaire.
${alertBlock}\n`;
        }
      }

      // Fetch tracked sites with detailed scores
      const { data: sites } = await sb
        .from("tracked_sites")
        .select("id, domain, display_name, geo_score, seo_score, llm_visibility_score, created_at")
        .eq("user_id", user_id)
        .limit(10);

      if (sites && sites.length > 0) {
        contextSnippet += "\n# SITES TRACKÉS DE L'UTILISATEUR\n";
        for (const s of sites) {
          contextSnippet += `- ${s.display_name || s.domain}: GEO ${s.geo_score ?? "N/A"}, SEO ${s.seo_score ?? "N/A"}%, LLM ${s.llm_visibility_score ?? "N/A"}% (ajouté le ${s.created_at?.slice(0, 10)})\n`;
        }

        // Read persistent memory for each site
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
          } catch (e) {
            console.error(`[sav-agent] Memory read error for ${s.domain}:`, e);
          }
        }

        // For each site, fetch latest audit & crawl info
        for (const s of sites.slice(0, 5)) {
          // Latest audit
          const { data: audits } = await sb
            .from("audit_raw_data")
            .select("audit_type, created_at")
            .eq("domain", s.domain)
            .eq("user_id", user_id)
            .order("created_at", { ascending: false })
            .limit(3);

          if (audits?.length) {
            contextSnippet += `  Audits ${s.domain}: ${audits.map(a => `${a.audit_type} (${a.created_at?.slice(0, 10)})`).join(', ')}\n`;
          } else {
            contextSnippet += `  ⚠ ${s.domain}: aucun audit réalisé\n`;
          }

          // Latest crawl
          const { data: crawls } = await sb
            .from("site_crawls")
            .select("status, total_pages, crawled_pages, avg_score, created_at")
            .eq("domain", s.domain)
            .order("created_at", { ascending: false })
            .limit(1);

          if (crawls?.length) {
            const c = crawls[0];
            contextSnippet += `  Dernier crawl ${s.domain}: ${c.status} (${c.created_at?.slice(0, 10)}) — ${c.crawled_pages}/${c.total_pages} pages, score moy: ${c.avg_score || '?'}\n`;
          } else {
            contextSnippet += `  ⚠ ${s.domain}: aucun crawl réalisé\n`;
          }

          // Action plans
          const { data: plans } = await sb
            .from("action_plans")
            .select("title, audit_type, is_archived, created_at")
            .eq("url", s.domain)
            .eq("user_id", user_id)
            .eq("is_archived", false)
            .limit(3);

          if (plans?.length) {
            contextSnippet += `  Plans d'action actifs ${s.domain}: ${plans.map(p => p.title).join(', ')}\n`;
          }

          // Injected scripts
          const { data: scripts } = await sb
            .from("audit_recommendations_registry")
            .select("title, is_resolved, category")
            .eq("domain", s.domain)
            .eq("user_id", user_id)
            .limit(5);

          if (scripts?.length) {
            const applied = scripts.filter(sc => sc.is_resolved).length;
            contextSnippet += `  Scripts ${s.domain}: ${applied}/${scripts.length} recommandations appliquées\n`;
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
- Si pertinent, mentionne l'offre Pro Agency à 59€/mois qui remplace Semrush (120€), Screaming Frog (200€/an) et les outils GEO (95-295€/mois)
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

    // Creator admin hint
    let creatorHint = "";
    if (isCreator) {
      creatorHint = `\n\n# MODE CRÉATEUR (ADMIN)
Cet utilisateur est un créateur/administrateur de la plateforme. Tu peux :
- Discuter ouvertement du backend, des tables, des edge functions, de l'architecture
- Mentionner les noms techniques (tables, fonctions, APIs, etc.)
- Donner des informations sur la structure de la base de données
- Partager des métriques système et des statistiques
- Expliquer le fonctionnement interne des algorithmes

Tu ne dois PAS :
- Modifier la logique backend (pas de suggestions de changements de code)
- Exécuter des opérations d'écriture (pas d'INSERT, UPDATE, DELETE)
- Partager des tokens, clés API ou secrets

Pour les questions nécessitant des données précises, suggère au créateur de poser la question en termes de données (ex: "combien d'utilisateurs Pro cette semaine") — le système exécutera automatiquement une requête sécurisée.
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

    const fullSystemPrompt = SYSTEM_PROMPT + contextSnippet + liveSearchContext + screenHint + guestHint + escalationHint + greetingHint + creatorHint + memoryPrompt;

    const aiMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages.slice(-20),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: false,
        max_tokens: isCreator ? 2000 : screenHint ? 1200 : 600,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Service temporairement surchargé, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service IA temporairement indisponible." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let rawReply = data.choices?.[0]?.message?.content || "Je transmets votre question à l'équipe.";

    // Extract and persist memory from LLM response
    const { cleanResponse, memories, identityUpdates } = parseMemoryExtraction(rawReply);
    let reply = cleanResponse;

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
        return new Response(JSON.stringify({ reply, conversation_id: savedConvId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.error("Save conversation error:", e);
    }
    } // end if (!isGuest)

    return new Response(JSON.stringify({ reply, conversation_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sav-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
