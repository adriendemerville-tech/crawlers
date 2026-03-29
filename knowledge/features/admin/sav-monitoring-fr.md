# Memory: features/admin/sav-monitoring-fr
Updated: 2026-03-29

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

## Agent Félix (Onboarding & Support)
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

## Scoring de précision (`sav_quality_scores`)
- precision_score (0-100), route_match, repeated_intent_count, escalated_to_phone
- Monitoring dans Admin → Intelligence → Supervisor → AssistantPrecisionCard
- Supervisor audite l'assistant (avg precision, escalation rate, repeated intents, route match rate)

## Agent Cocoon → Stratège Cocoon (Assistant Maillage)
- Renommé "Stratège Cocoon" en front-end
- Détection automatique de la langue
- Bouton seringue pour injecter les instructions de maillage
- Historique : `cocoon_chat_histories`
- **Mémoire persistante** : reprend la conversation précédente avec contexte ("Bonjour Prénom, nous avions travaillé sur...")
- **Bouton horloge** : accès historique des sessions passées
- **Signalement bugs** : même circuit que Crawler → `user_bug_reports` → CTO → notification résolution
- **Changement auto** : historique et conversation changent quand l'utilisateur sélectionne un autre site/URL
- **Boutons d'action** : taille maximale réduite pour éviter la superposition avec le bouton "+" en bas à droite

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
