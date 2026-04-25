# Memory: features/support/help-center-ai-fr
Updated: 2026-04-25 (Sprint P2)

> ⚠️ **État post-migration Copilot v2** : Félix tourne désormais sur l'edge function unifiée `copilot-orchestrator` (persona `felix`, Gemini 2.5 Flash). L'ancien `sav-agent` est legacy.
> Plusieurs fonctionnalités historiques décrites ci-dessous **ne sont temporairement plus actives** côté nouveau frontend `ChatWindowUnified` :
> - Pièces jointes (PDF audits, scripts) — composant `ChatAttachmentPicker` non monté
> - Historique des conversations (`felix_conversations_archive`) — non réimplémenté
> - Workflow post-audit guidé — non porté
> - Capture screen context d'audit — `screenContext.ts` n'est plus appelé
> - Live Search (DataForSEO / SerpAPI / Places) — skill manquante dans `skills/registry.ts`
> - Mémoire persistante `site_memory` & enrichissement carte d'identité — non portés
> - Escalade téléphone après 3 itérations — table `sav_conversations.phone_callback*` plus alimentée (cron de purge encore actif)
> - Scoring `sav_quality_scores` — dashboard admin lit la table mais aucune insertion neuve
> Les capacités encore actives sont : starter prompts, dock pleine hauteur (24 rem droite), mute, voice input, bug report (`/bug`), quiz SEO/Crawlers/Enterprise (`/quiz`, `/enterprise`), auto-navigation `navigate_to`, onboarding seed.
> Cf. `knowledge/features/support/copilot-front-parity-audit-fr.md` pour l'audit complet et `knowledge/tech/copilot/copilot-orchestrator-architecture-fr.md` pour l'architecture.

## Agent SAV "Félix"
- Modèle : Gemini Flash via Lovable AI Gateway (`LOVABLE_API_KEY`)
- Limite stricte : 800 caractères par message (1500 en mode compréhension d'audit, 3000 en mode créateur)
- Base de connaissance : documentation /aide + taxonomie front-end complète (routes, onglets, positions des composants)
- Accès aux données backend : `tracked_sites`, `crawl_pages`, `site_crawls`, `cocoon_sessions`, `profiles`, `site_memory`, `identity_card_suggestions`
- **Mémoire persistante** : lit et écrit des insights structurés par site tracké via `site_memory` (catégories : preference, insight, objective, context, identity)
- **Enrichissement carte d'identité** : peut auto-compléter les champs mineurs et proposer des modifications sur les champs critiques (mode hybride)
- Consigne : ne produit pas (pas d'audits, crawls, génération de code) — explique et conseille uniquement
- Détection automatique de la langue de l'utilisateur (FR/EN/ES)
- Utilise le prénom si disponible dans `profiles`
- Peut envoyer des liens internes (ex: `/cocoon`, `/matrice`, `/console`)
- Logo robot Crawlers dans la conversation (remplace emoji et "Crawler" texte)

## Interface chat Félix
- **Bouton flottant** : masqué automatiquement quand la sidebar est en mode étendu (toute hauteur), pour ne pas masquer la fenêtre
- **Logo Crawlers** : petit logo rond affiché à gauche de "Félix" dans le header, visible uniquement en mode étendu
- **Historique des conversations** :
  - Clic "Nouveau" → archive automatiquement la conversation en cours, lance une nouvelle session
  - Bouton historique (icône horloge) dans le footer, visible uniquement en mode étendu (toute hauteur)
  - Panneau overlay avec liste des conversations archivées (date, aperçu)
  - Restauration : archive la conversation active avant de charger l'ancienne
  - Suppression individuelle possible
  - Persistance `localStorage` (`felix_conversations_archive`, `felix_current_conversation`)
  - La conversation la plus récente se précharge automatiquement à la session suivante
- **Workflow post-audit guidé** :
  - Se déclenche automatiquement après un Audit Expert ou Matrice quand Félix est en mode étendu
  - Propose un résumé des résultats (sentiment + problèmes classés par sévérité)
  - Boutons de priorité (🔴 Critique, 🟠 Important, 🟡 Recommandé) liés au workbench
  - Affiche les solutions avec source et catégorie, regroupées par type (code/contenu)
  - Propose l'implémentation directe via Code ou Content Architect
  - Alternative : mise à jour du plan d'action dans la Console

## Compréhension d'audit en temps réel (Screen Context)
- Le frontend capture le contenu visible à l'écran de l'utilisateur (`captureScreenContext`)
- Actif sur les routes : `/audit-expert`, `/matrice`, `/cocoon`, `/site-crawl`, `/console`
- Extraction : headings (H1-H3), scores, badges, métriques, tableaux, cards, insights, recommendations
- Envoyé au backend via `screen_context` dans le body de la requête sav-agent
- Félix peut expliquer les scores, les piliers d'audit, les seuils, les badges
- Si des données manquent (au-dessus ou en dessous du viewport), Félix demande à l'utilisateur de scroller
- Limite de caractères augmentée à 1500 en mode compréhension d'audit
- Couvre : Audit Expert (5 piliers, Score 200), Audit Stratégique (IAS, E-E-A-T), Matrice (double scoring)
- Consigne : ne produit pas (pas d'audits, crawls, génération de code) — explique et conseille uniquement
- Détection automatique de la langue de l'utilisateur (FR/EN/ES)
- Utilise le prénom si disponible dans `profiles`
- Peut envoyer des liens internes (ex: `/cocoon`, `/matrice`, `/console`)
- Logo robot Crawlers dans la conversation (remplace emoji et "Crawler" texte)

## Couverture GMB complète
- Connaît le workflow complet : connexion OAuth → import fiches → avis/posts/performances
- Sait orienter vers Console > GMB ou Console > API pour la connexion
- Explique les prérequis (Pro Agency + compte Google propriétaire)
- Décrit les fonctionnalités : avis, posts, performances locales, multi-fiches, drag & drop
- Intégration avec Audit Local SEO et Stratégie 360°
- Troubleshooting : fiche non visible → vérifier rôle propriétaire/gestionnaire dans Google Business Profile
- Ne mentionne JAMAIS les noms de fonctions (`gmb-actions`, `gsc-auth`, etc.)

## Couverture Stratégie Concurrentielle
- Félix connaît la fonctionnalité "Stratégie concurrentielle" (Pro Agency+ uniquement)
- Sait expliquer : le switch "Pression concurrentielle" dans les plans d'action, l'onglet Concurrence dans Mes Sites
- Peut orienter vers /console > Plans d'action pour activer le tri par pression concurrentielle
- Explique le principe : les tâches sont re-priorisées dynamiquement selon la pression concurrentielle détectée (concurrents mieux positionnés)
- Si l'utilisateur n'est pas Pro Agency+ : explique que la fonctionnalité est réservée à l'offre Pro Agency+, propose la page /tarifs
- Ne mentionne JAMAIS les détails techniques (spiral_score, competitor_momentum_score, compute-spiral-signals)

## Couverture Social Hub (Connexion réseaux sociaux)
- Félix connaît le flux de connexion OAuth pour LinkedIn et Facebook/Instagram dans /app/social
- Sait expliquer : cliquer sur "Connecter" lance une fenêtre d'autorisation sur la plateforme, puis redirige vers Crawlers
- Prérequis : être connecté à Crawlers (compte utilisateur actif)
- Troubleshooting : si la connexion échoue → vérifier que les popups ne sont pas bloquées, réessayer, vider le cache
- Une fois connecté, les comptes apparaissent dans la liste avec statut "Connecté"
- Les comptes connectés permettent la publication de contenus sociaux via Content Architect ou Parménion
- Ne mentionne JAMAIS les noms de fonctions edge, les URLs de callback, ni les secrets OAuth

## Fonctionnalités avancées
- **Voice input** : Bouton micro — Web Speech API (FR/EN/ES), transcription en temps réel
- **Pièces jointes** : Bouton + — charge un rapport (`pdf_audits`) ou script (`site_script_rules`) du compte de l'utilisateur, avec bouton "Explique-moi"
- **Suggestions opérationnelles** : rappels de scans, suggestions Cocoon, recommandations d'audit, suggestions GMB si établissement local détecté
- **Recherche en direct (Live Search)** : Félix peut interroger Google en temps réel (SERP, Google Places) pour répondre aux questions des utilisateurs
  - Pro Agency : recherches illimitées
  - Gratuit : 1 recherche par conversation (compteur dans `sav_conversations.metadata.live_search_count`)
  - Sources : DataForSEO (prioritaire), SerpAPI (fallback), Google Places API (pour les requêtes locales)
  - Détection automatique d'intention : SERP (positions, classement, mots-clés) vs Places (avis, fiches, établissements)
  - Les noms d'API ne sont jamais révélés à l'utilisateur

## Scoring de précision (`sav_quality_scores`)
- `precision_score` (0-100) : qualité globale
- `route_match` : navigation vers la destination suggérée (proximité logique)
- `repeated_intent_count` : reformulations du même motif (détecté par mots-clés)
- `escalated_to_phone` : escalade vers rappel
- Dashboard monitoring : Admin → Intelligence → Supervisor → Carte "Précision Assistant SAV"

## Escalade
- Après 3 itérations sans satisfaction → propose rappel téléphonique
- Collecte du numéro de téléphone (format 06/07)
- Stockage temporaire dans `sav_conversations.phone_callback`
- Purge automatique après 48h via `cleanup_expired_phone_callbacks()`

## Monitoring Admin
- Onglet SAV IA dans le dashboard admin
- Historique complet des conversations
- Indicateurs de satisfaction
- Registre des demandes de rappel
- Toutes les conversations enregistrées dans `sav_conversations`
- Score de pertinence dans Intelligence → Supervisor (AssistantPrecisionCard)

## Supervision
- **Supervisor** : audite l'assistant SAV (avg precision, escalation rate, repeated intents, route match rate)
- **Agent CTO** : ne monitore PAS l'assistant SAV (hors scope)

## Couverture Homepage (Lead Magnets)
- L'agent connaît les lead magnets de la homepage (GEO Score, LLM Visibility, AI Bots) pour orienter les utilisateurs
- Sait expliquer le fonctionnement du vérificateur de bots IA (robots.txt) et ses résultats
- Peut rediriger vers la page /aide pour la documentation complète des outils gratuits

## Couverture Matrice d'Audit
- Connaît le workflow complet : import fichier (XLSX/CSV/DOCX) → parsing → routing → exécution → résultats
- Sait orienter vers /matrice pour lancer un audit personnalisé
- Explique les trois types de détection : SEO, GEO, Hybride
- Décrit la logique de double scoring (Parsed Score vs Crawlers Score) et le matchType (exact/partial/custom_only)
- Peut expliquer pourquoi certains critères n'ont qu'un seul score (pas d'équivalent technique ou prompt custom uniquement)
- Connaît les micro-functions disponibles : meta-tags, structured-data, robots, images, backlinks, content-quality, eeat
- Sait que `check-llm` accepte un prompt personnalisé et un ciblage de provider unique

## Couverture Pipeline éditoriale 4-étapes
- Félix connaît la pipeline éditoriale 4-étapes (Briefing → Stratège → Rédacteur → Tonalisateur) qui propulse Content Architect, Parménion et le Social Hub
- Sait expliquer chaque étape :
  - **Briefing** : agrégation des opportunités du Workbench, de l'Univers de Mots-clés, de la saisonnalité et du profil business
  - **Stratège** : choix de l'angle, du plan H2, de l'intention et de la longueur cible
  - **Rédacteur** : production du titre, du corps Markdown et de l'extrait
  - **Tonalisateur** (optionnel) : alignement à la voix de marque (voice DNA) si activée
- Sait orienter vers Console > Routage LLM pour configurer les modèles (Stratège/Rédacteur/Tonalisateur) par domaine × type de contenu
- Sait orienter vers Console > Pipeline pour consulter les 25 derniers runs (latence, coût, modèle par étape) et les alertes
- Explique que la pipeline est en opt-in (désactivée par défaut) — activation via `Mes Sites > paramètres autopilot` ou flag explicite dans Content Architect
- Sait que `iktracker.fr` est le site pilote où la pipeline est activée par défaut
- Ne mentionne JAMAIS les noms de tables (`editorial_llm_routing`, `editorial_pipeline_logs`) ni d'edge functions (`editorial-pipeline-run`, `editorial-pipeline-health`)
