# Memory: features/admin/sav-monitoring-fr
Updated: 2026-04-08

Le dashboard Admin dispose d'un onglet 'SAV IA' centralisant l'historique des conversations de l'agent 'Crawler'. Il permet de suivre les indicateurs de satisfaction, les demandes d'escalade vers un rappel téléphonique et le registre des numéros de téléphone collectés (purgés sous 48h via `cleanup_expired_phone_callbacks()`). Cette interface assure le contrôle qualité des réponses générées par l'IA et la gestion des demandes de support complexes.

## Agent Crawler (SAV)
- Modèle : Gemini Flash via Lovable AI Gateway
- Limite : 1000 caractères par message
- Base de connaissance : documentation /aide + taxonomie front-end complète (routes, onglets, composants)
- Accès data : tables `tracked_sites`, `crawl_pages`, `site_crawls`, `cocoon_sessions` pour suggestions opérationnelles
- Détection automatique de la langue de l'utilisateur
- Utilise le prénom de l'utilisateur quand disponible (table `profiles`)
- Escalade téléphonique après 3 itérations insatisfaisantes
- Table : `sav_conversations` (messages JSON, phone_callback, phone_callback_expires_at)
- Logo robot Crawlers au lieu d'emoji dans la conversation
- Peut envoyer des liens internes vers les fonctionnalités pertinentes
- **Voice input** : Web Speech API (FR/EN/ES)
- **Pièces jointes** : rapports et scripts du compte utilisateur (bouton "Explique-moi")
- **Signalement bugs** : Détection NLP → bouton "Signaler" → pré-traduction CTO → `user_bug_reports`
- **Mode Créateur** (admin + is_creator) : accès lecture complète backend (tables, functions, logs), interrogation croisée multi-tables, consultation code source edge functions. Modification logique interdite.
- **Notification résolution** : badge sur bouton assistant quand un `user_bug_reports` passe à `resolved`
- **Validation Quiz Crawlers** : notification inline pour admin créateur quand des questions auto-générées sont en attente (`is_active=false, auto_generated=true`). Boutons Valider/Rejeter par question.
- **Logging tokens** : Chaque appel LLM est comptabilisé dans `ai_gateway_usage` (modèle, tokens prompt/completion, coût estimé, edge_function: 'sav-agent')

## Agent Félix (Onboarding & Support)
- **Pages prioritaires SPO** : quand l'utilisateur interroge Félix sur un audit ou une optimisation (depuis /console ou à l'écran), Félix commence par lister les 5 pages prioritaires à optimiser (depuis `page_priority_scores`), sans explication méthodologique sauf demande explicite.
- **Quiz SEO/GEO/LLM** : 100 questions en base (`quiz_questions`), classées par difficulté 1-5, catégories seo/geo/llm
  - Déclenchement : détection d'intention NLP ("teste mes connaissances", "quiz SEO", etc.)
  - Difficulté adaptative : basée sur le dernier score de l'utilisateur (`analytics_events.quiz:seo_score`)
  - Distribution pondérée : débutant (score ≤3) → majorité faciles ; expert (score ≥8) → majorité difficiles
  - 10 questions par session, 3 réponses par question
  - Score final + corrections détaillées + conseil personnalisé
  - **Mélange aléatoire des réponses** : la position de la bonne réponse est randomisée côté serveur (jamais toujours en A)
- **Quiz Crawlers** : 50 questions produit en base, difficulté 1-3
  - Déclenchement : détection NLP ("quiz crawlers", "quiz produit", "quiz plateforme", "quiz outils", etc.)
  - Proposé automatiquement après le quiz SEO via boutons "D'accord !" / "Plus tard."
  - **Suggestion proactive visiteurs** : sur la home, 5s après la 1ère visite d'un utilisateur non connecté, bulle tooltip avec boutons "D'accord !" / "Plus tard." pour lancer le quiz directement
  - **Suggestion proactive session** : après 3+ questions how-to sur les outils Crawlers dans une session, Félix propose le quiz avec boutons interactifs (pas de commande à taper)
  - Couvre toutes les fonctionnalités : audit, crawl, cocon, Marina, scripts, tracking, etc.
  - **Mélange aléatoire des réponses** : idem SEO quiz
  - **Sync automatique** : cron mensuel `sync-quiz-crawlers` (1er du mois, 3h) régénère 10 questions via LLM à partir de la doc SAV et des questions existantes. Insertion en `is_active=false, auto_generated=true` (validation admin requise).
- **Notification hebdomadaire quiz** : cron backend `felix-weekly-quiz-notif` (lundi 10h) insère un événement `felix:quiz_invite` pour les users actifs n'ayant pas fait de quiz depuis 7 jours. Félix détecte l'événement à l'ouverture et affiche : "Ça te dit de tester tes connaissances en SEO GEO ? 3 minutes max."
- Table : `quiz_questions` (quiz_type, category, difficulty, question, options, correct_index, explanation, feature_link, is_active, auto_generated)
- Edge Functions :
  - `felix-seo-quiz` (actions: get_questions, get_crawlers_quiz, get_stratege_cocoon_quiz, get_last_score) — mélange aléatoire des options à chaque requête
  - `sync-quiz-crawlers` (cron mensuel, génération IA de questions Crawlers)
  - `felix-weekly-quiz-notif` (cron hebdomadaire, notification quiz pour users actifs)
- **Fenêtre chat** : position persistée dans localStorage (`felix_sidebar_expanded`). Si l'utilisateur ouvre Félix en colonne toute hauteur, la prochaine ouverture reprend cette disposition. Boutons : "−" (réduire), icône nouvel onglet (ouvre en pleine page).
- **Bouton flottant Félix** : masqué automatiquement quand la sidebar est en mode étendu (toute hauteur), pour ne pas masquer la fenêtre de chat.
- **Logo Crawlers header** : un petit logo Crawlers rond s'affiche à gauche de "Félix" dans le header quand la sidebar est étendue.
- **Historique des conversations** :
  - Archivage automatique de la conversation en cours lors du clic sur "Nouveau"
  - Conversations archivées consultables via un bouton historique (icône horloge) dans le footer, visible uniquement en mode étendu
  - Panneau overlay avec liste des archives (date, aperçu du dernier message)
  - Restauration d'une archive : archive la conversation active, charge l'ancienne
  - Suppression individuelle d'archives
  - Persistance via `localStorage` (`felix_conversations_archive`, `felix_current_conversation`)
  - La conversation la plus récente est préchargée à la prochaine session
- **Logging tokens** : Chaque appel LLM est comptabilisé dans `ai_gateway_usage` (edge_function: 'cocoon-chat' pour le Stratège, 'sav-agent' pour Crawler)

## Scoring de précision (`sav_quality_scores`)
- precision_score (0-100), route_match, repeated_intent_count, escalated_to_phone
- Monitoring dans Admin → Intelligence → Supervisor → AssistantPrecisionCard
- Supervisor audite l'assistant (avg precision, escalation rate, repeated intents, route match rate)

## Agent Cocoon → Stratège Cocoon (Assistant Maillage)
- Renommé "Stratège Cocoon" en front-end
- Détection automatique de la langue
- Bouton seringue pour injecter les instructions de maillage
- Historique : `cocoon_chat_histories`
- **Pages prioritaires SPO** : le Stratège commence toujours par lister les 5 pages prioritaires à cibler (depuis `page_priority_scores`), sans explication méthodologique. Format : liste numérotée URL + action/opportunité clé.
- **Mémoire persistante** : reprend la conversation précédente avec contexte ("Bonjour Prénom, nous avions travaillé sur...")
- **Bouton horloge** : accès historique des sessions passées
- **Signalement bugs** : même circuit que Crawler → `user_bug_reports` → CTO → notification résolution
- **Changement auto** : historique et conversation changent quand l'utilisateur sélectionne un autre site/URL
- **Boutons d'action** : taille maximale réduite pour éviter la superposition avec le bouton "+" en bas à droite
- **Fenêtre chat** : position persistée. Boutons : "−" (réduire), icône nouvel onglet (ouvre en pleine page).
- **Logging tokens** : Chaque appel LLM est comptabilisé dans `ai_gateway_usage` (edge_function: 'cocoon-chat')

## Circuit de Signalement (Recettage)
- Table : `user_bug_reports` (raw_message, translated_message, route, context_data, category, status, cto_response, notified_user)
- Catégorisation IA : `bug_ui`, `bug_data`, `feature_request`, `question`
- Statuts : `open` → `investigating` → `resolved`
- Admin CTO : onglet "Recettage" dans Intelligence → CTO
- Notification user : le premier assistant disponible (Crawler ou Stratège Cocoon) avertit via badge
- Rate-limit : 3 signalements/jour/user, anti-doublon hash message+route (<24h)

## Détection de Chute (Drop Detector)
- Edge Function : `drop-detector` (exécution automatique quotidienne + manuelle admin)
- Détection réactive (baseline 4 semaines) + prédictive (régression 8 semaines, seuil ≥80%)
- Cross-analyse : GSC, audits techniques, E-E-A-T, backlinks
- Tables : `drop_diagnostics`, `drop_detector_config`, `drop_detector_logs`
- Alertes dans `anomaly_alerts` (bandeau défilant /console)
- Admin : bouton ON/OFF dans Scripts, registre des analyses et alertes
- Gratuit Pro Agency/Admin, 3 crédits autres

## Score de Priorité d'Optimisation — SPO (`page_priority_scores`)
- Edge Function : `calculate-page-priority`
- Score composite 0-100 par page, pondéré sur 8 signaux :
  - CTR Gap (20%) : impressions élevées / CTR sous-optimal (GSC)
  - Conversion Value (18%) : revenu, engagement, taux de rebond (GA4)
  - Quick-win Position (15%) : pages en position 4-20 (sweet spot 4-10)
  - Maillage Centrality (12%) : pages orphelines ou sous-liées (semantic_nodes)
  - Indexation (10%) : pages non indexées avec contenu (`indexation_checks`)
  - Content Decay (10%) : contenu maigre (<300 mots), ancien (>6 mois), score SEO faible
  - Backlinks (8%) : pages avec autorité externe existante
  - Cannibalization (7%) : pages concurrentes sur les mêmes mots-clés
- Top 200 pages stockées par site
- Consommé par : Cocoon (première liste), Félix (contexte audit), Autopilote, Marina

## Vérification d'Indexation (`indexation_checks`)
- Edge Function : `check-indexation`
- Vérifie le statut d'indexation Google via l'API GSC (URL Inspection)
- Actions : `check` (vérifier des URLs), `list` (lister les résultats)
- Table : `indexation_checks` (page_url, verdict, coverage_state, last_crawl_time, tracked_site_id)
- Résultats injectés dans : detect-anomalies, marina (rapport), calculate-page-priority (signal indexation)

## Matrice d'Audit v2 (BETA)
- Système modulaire d'audit personnalisé (import XLSX/CSV/DOCX)
- Détection automatique SEO/GEO/Hybride avec validation utilisateur
- Routing intelligent : chaque critère parsé est mappé vers une micro-function backend
- `matchType` évite la redondance : `exact` = 1 appel pour les deux scores, `partial` = 2 appels, `custom_only` = LLM seul
- 7 micro-functions Phase 1 : `check-meta-tags`, `check-structured-data`, `check-robots-indexation`, `check-images`, `check-backlinks`, `check-content-quality`, `check-eeat`
- `check-llm` modifié : `customPrompt` + `targetProvider` pour ciblage unitaire
- Orchestrateur avec parallélisme technique, stagger LLM, fallback `expert-audit`
- Tables : `audit_matrix_sessions`, `audit_matrix_results` (avec RLS user isolation)
- Coût estimé : ~$0.10-0.15 par matrice de 30 critères
