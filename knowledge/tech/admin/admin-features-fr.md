# Memory: tech/admin/admin-features-fr
Updated: 2026-04-08

## Dashboard Admin — Fonctionnalités

### Onglets principaux
- **Utilisateurs** : KPIs par utilisateur, archivage, rôles (`user_roles` avec enum `app_role`)
- **SAV IA** : Historique conversations agent Crawler, indicateurs satisfaction, escalade téléphonique
- **Finances** : Suivi coûts API (Spider, Firecrawl, DataForSEO, SerpAPI), revenus Stripe
- **Algo Training** : Entraînement et monitoring des modèles de scoring (GEO, SEO, prédictions)
- **Bundle Option** : Catalogue APIs tierces (`bundle_api_catalog`), abonnements bundle
- **Intelligence Hub** : Supervisor (agents + assistant SAV), Agent CTO + Recettage, Error Registry

### Intelligence Hub — Supervisor
- **Carte Précision Assistant SAV** (`AssistantPrecisionCard`) :
  - Score moyen de précision (0-100, color-coded)
  - Taux de route match (navigation correcte)
  - Taux d'escalade téléphonique
  - Taux d'intentions répétées
  - Engagement moyen (messages/session)
  - Données depuis `sav_quality_scores` + `sav_conversations` (7 derniers jours)

### Intelligence Hub — CTO — Recettage
- Nouvel onglet "Recettage" dans CTO
- Liste des signalements utilisateurs (`user_bug_reports`)
- Statuts : `open` → `investigating` → `resolved`
- Catégories IA : `bug_ui`, `bug_data`, `feature_request`, `question`
- Le CTO peut marquer "resolved" + ajouter une réponse
- À la résolution, notification automatique à l'utilisateur via assistant (Crawler ou Stratège Cocoon)

### Agent CTO
- Monitore désormais `content-architecture-advisor` + `drop-detector` + `frontend_crash` en plus des autres edge functions
- Registry dans `AUDIT_TYPE_TO_FUNCTION`
- **Diagnostic crashs frontend** : Action `diagnose_frontend_crashes` — analyse chaque crash frontend avec LLM, classifie en data-side (corrigeable, confiance ≥ 85%) ou code-side (recommandation), crée automatiquement un signalement dans `user_bug_reports` avec diagnostic complet
- Bouton "Diagnostiquer crashs" dans le journal CTO du Hub Intelligence
- `GlobalErrorBoundary` (App.tsx) + `globalErrorListener` (main.tsx) capturent tous les crashs React et JS et les loguent dans `analytics_events` (`event_type: 'frontend_crash'`)

### Scripts — Drop Detector
- Bouton ON/OFF pour le détecteur de chute (`drop_detector_config`)
- Registre des exécutions (`drop_detector_logs`) : sites scannés, alertes générées, durée
- Bouton "Run Now" pour exécution manuelle
- Registre des diagnostics récents (`drop_diagnostics`)

### Architecte (Script) — Onglets restreints admin
- **Basique** : Fixes techniques SEO automatiques (title, meta, H1, schema.org, etc.)
- **Super** : Fixes génératifs (FAQ, info box expert, contenus enrichis)
- **Stratégie** : Roadmap stratégique, action plans, fixes liés aux audits
- **Contenu** ⚠️ ADMIN ONLY : Content Architecture Advisor — recommandations architecture de contenu
- **Scribe** ⚠️ ADMIN ONLY, BETA : Générateur de contenu avancé avec 13 paramètres :
  - Prompt (instructions libres)
  - URL cible
  - Type de page (homepage, produit, article, FAQ, landing, catégorie, service, à propos)
  - Longueur cible (court ~500, moyen ~1200, long ~2500+)
  - Photo/média URL
  - Lien CTA cible
  - Mot-clé cible (détection DataForSEO)
  - Ton éditorial (auto via carte d'identité, professionnel, conversationnel, expert, institutionnel, chaleureux)
  - Langue (FR/EN/ES/auto)
  - Persona/cible (B2B décideur, B2C grand public, B2C premium, expert technique, étudiant, audience locale)
  - Niveau de jargon (slider 1-10, bridé par guardrail cohérence)
  - Maillage interne auto via Cocoon
  - URLs concurrentes à analyser (1-3)
- **Multi** : Router multi-pages pour génération de scripts sur plusieurs URLs
- Les onglets Contenu, Scribe et Multi sont **cachés en mode démo** (`openMode`)

### Garde-fous Content Architecture Advisor
- Pénalités de confiance pour innovation disruptive en secteurs conservateurs
- Cap automatique du jargon à 25% si `jargon_distance` > 6
- Filtrage CTAs agressifs pour services publics/ONG
- Continuité tonale vérifiée par rapport au ton existant du domaine

### 5 Critères GEO (conditionnels, individuels ou cumulatifs)
Chaque critère s'active selon le contexte (entité, taille, business, cible, SERP, concurrence, GEO score, visibilité LLM, GMB, backlinks) :
1. **Répondre aux questions clés** — ACTIF si article/FAQ/landing, featured snippet, PAA détectés. Renforcé si GEO < 50 ou invisible LLM.
2. **Structurer pour la compréhension** — ACTIF si word_count > 800, page technique, jargon_distance > 4. Renforcé si B2C/étudiant/local.
3. **Passages citables** — ACTIF si GEO < 70, invisible LLM, pas de featured snippet. Renforcé si faible domain_rank, pas de backlinks.
4. **Signaux E-E-A-T** — ACTIF si secteur YMYL, B2B, cible expert. Renforcé si pas de GMB, faible domain_rank, forte concurrence.
5. **Enrichissement sémantique** — TOUJOURS ACTIF. Renforcé si forte concurrence SERP, cible expert technique.

### Sources de données du Content Architecture Advisor
- `tracked_sites` (carte d'identité : secteur, cible, GMB, entity_type, nonprofit_type, jargon_distance, competitors)
- `domain_data_cache` (geo_score, llm_visibility, serp_keywords)
- `backlink_snapshots` (referring_domains, domain_rank)
- `audit_raw_data` (derniers audits)
- `cocoon_sessions` (maillage, clusters)
- DataForSEO (keywords, SERP live)
- Firecrawl (TF-IDF concurrents)

### Signup — Code d'affiliation
- Bouton "J'ai un code d'affiliation" dans la couche persona (PersonaGate)
- Vérification automatique debounced (600ms) contre `affiliate_codes`
- Coche verte si valide, vibration + effacement si invalide
- Code persisté dans `profiles.affiliate_code_used` au signup via sessionStorage

### Matrice d'Audit v2 (BETA — Admin only)
- Import XLSX/CSV/DOCX → parsing automatique des critères SEO/GEO/Hybride
- Nettoyage client-side (`cleanMatrixData()`) : suppression URLs, scores existants, balises HTML, emails, IPs
- Normalisation DOCX via LLM (Gemini Flash Lite) → `normalizeDocxToMatrix()`
- Routing intelligent (`resolveAuditRoutes()`) : mappe chaque critère vers une micro-function backend via regex
- `matchType` : `exact` (1 appel, double score), `partial` (2 appels), `custom_only` (LLM seul)
- Orchestrateur (`matrixOrchestrator`) : parallélisme technique, stagger LLM (250ms), fallback `expert-audit`
- Tables : `audit_matrix_sessions` (état global), `audit_matrix_results` (scores individuels)
- Validation post-parsing obligatoire (UI) avec indicateur de confiance par critère
- Barre de progression temps réel (X/N critères évalués)

### Micro-Functions Matrice (Phase 1)
- `check-meta-tags` : Title, meta desc, canonical, H1, H2-H6, Open Graph (coût 0)
- `check-structured-data` : JSON-LD, types Schema.org, validation (coût 0)
- `check-robots-indexation` : robots.txt, directives bots IA, meta robots, sitemap (coût 0)
- `check-images` : Alt manquants, formats, images lourdes (coût 0)
- `check-backlinks` : Domaines référents, Domain Rank, distribution ancres (DataForSEO ~$0.05)
- `check-content-quality` : Score rédactionnel, lisibilité, profondeur (Gemini Flash Lite ~$0.002)
- `check-eeat` : Signaux E-E-A-T ciblés (Gemini Flash Lite ~$0.003)
- `check-llm` modifié : ajout `customPrompt` (prompt exact user) + `targetProvider` (ciblage 1 LLM)

### Score de Priorité d'Optimisation — SPO (`page_priority_scores`)
- Edge Function : `calculate-page-priority`
- Score composite 0-100 par page, pondéré sur 8 signaux :
  - CTR Gap (20%), Conversion Value (18%), Quick-win Position (15%), Maillage Centrality (12%), Indexation (10%), Content Decay (10%), Backlinks (8%), Cannibalization (7%)
- Sources : `crawl_pages`, `gsc_keyword_rankings`, `ga4_top_pages`, `semantic_nodes`, `indexation_checks`, `crawl_page_backlinks`, `revenue_events`
- Top 200 pages stockées par site, consommé par Cocoon, Félix, Autopilote, Marina
- Cocoon commence toujours par les 5 pages prioritaires ; Félix les affiche en contexte d'audit

### Vérification d'Indexation GSC (`check-indexation`)
- Edge Function : `check-indexation`
- Vérifie le statut d'indexation Google via l'API GSC (URL Inspection)
- Table : `indexation_checks` (page_url, verdict, coverage_state, last_crawl_time, tracked_site_id)
- Résultats injectés dans : `detect-anomalies`, `marina` (rapport), `calculate-page-priority` (signal indexation)
- Actions : `check` (vérifier des URLs), `list` (lister les résultats)

### Bandeau d'alertes Console
- Bandeau défilant GA4/GSC dans /console (anomaly_alerts)
- Option profil utilisateur : masquer par défaut (`ProfileSettings` → toggle Bandeau d'alertes)
- Trilingue FR/EN/ES

### Edge Functions associées
- `content-architecture-advisor` : Analyse et recommandations de structure de contenu
- `generate-infotainment` : Génération de cartes news/tips SEO/GEO
- `generate-blog-from-news` : Articles de blog auto-générés depuis les news
- `agent-seo-v2` : Audit SEO avancé 7 axes
- `process-script-queue` : File d'attente FIFO pour génération de scripts
- `supervisor-actions` : Audit des agents + assistant SAV
- `drop-detector` : Détection de chute réactive + prédictive
- `strategic-orchestrator` : Pipeline modulaire audit GEO (5 micro-fonctions)
- `strategic-crawl` / `strategic-market` / `strategic-competitors` / `strategic-synthesis` : Micro-fonctions du pipeline
- `autopilot-engine` : Parménion v2 — double cycle macro/micro, scoring déterministe 11 tiers, 4 canaux LLM (emit_code, emit_corrective_data, emit_corrective_content, emit_editorial_content), dispatch vers iktracker-actions ou generate-corrective-code, **prompts SEO/GEO par type de page** (landing/produit/article) depuis `content_prompt_templates`
- `run-backend-tests` : 12 tests CI (sécurité, facturation, audit, tracking)
- `felix-seo-quiz` : Quiz adaptatif SEO/GEO/LLM + Quiz Crawlers + Quiz Stratège Cocoon. Mélange aléatoire de la position des bonnes réponses (`shuffleOptions`) à chaque requête. Actions : `get_questions`, `get_crawlers_quiz`, `get_stratege_cocoon_quiz`, `get_last_score`.
- `sync-quiz-crawlers` : Cron mensuel (1er du mois, 3h) — régénère 10 questions Crawlers via LLM + doc SAV, sauvées `is_active=false` en attente de validation admin dans Félix
- `felix-weekly-quiz-notif` : Cron hebdomadaire (lundi 10h) — insère `felix:quiz_invite` dans `analytics_events` pour les users actifs n'ayant pas fait de quiz depuis 7 jours. Félix détecte et affiche la notification d'invitation.
- `calculate-page-priority` : Score de Priorité d'Optimisation (SPO) — scoring 8 signaux par page
- `check-indexation` : Vérification statut d'indexation Google via API GSC
- **Quiz visiteurs non connectés** : Sur la home, 5s après la 1ère visite, Félix propose le quiz Crawlers via tooltip avec boutons "D'accord !" / "Plus tard." (sessionStorage `felix_guest_quiz_suggested`). Le quiz se lance directement dans le chat via `autoStartCrawlersQuiz` prop.

### Fallback LLM (Gemini Pro → Flash)
- `strategic-synthesis` et `audit-strategique-ia` intègrent un fallback automatique
- Si Gemini 2.5 Pro dépasse 2m30, bascule sur Gemini 2.5 Flash (120s timeout)
- Évite les blocages silencieux sur les audits stratégiques longs

### Tests CI Backend (12 tests)
- **Sécurité** : SSRF, Turnstile, ensure-profile, auth middleware unifié
- **Facturation** : Calcul prix dynamique, create-checkout
- **Audit** : validate-url, robots.txt parser, cache déterministe, LLM fallback endpoints
- **Tracking** : Résilience token tracker, headers CORS


## Homepage — Améliorations SEO/GEO (v5.1 — 2026-03-29)

### Section "Comment ça marche" (`HowItWorksSection`)
- Nouvelle section ajoutée sur la homepage entre les sections existantes
- 4 étapes visuelles : Analyser → Scorer → Prioriser → Déployer
- Chaque étape : icône, titre, description du bénéfice concret
- Design responsive avec grille 4 colonnes

### Pages SEO créées
- **`/a-propos`** : Page E-E-A-T complète — bio fondateur (Mukesh Bagri), mission, histoire, valeurs, chiffres clés, technologie. JSON-LD `Person` intégré.
- **`/audit-semantique`** : Landing page SEO ciblant "audit sémantique" (880/mois). Sections : définition, fonctionnement, comparaison technique vs sémantique, CTA. FAQ + JSON-LD `FAQPage`.

### Schema.org — Corrections
- Suppression du `sameAs` invalide vers "caroulepartout" dans le schéma `Organization`
- Ajout d'un champ `founder` (`Person` JSON-LD) dans `Organization` (Mukesh Bagri)
- Liens `sameAs` mis à jour vers les profils réels (LinkedIn, X/Twitter)

### Section Logos LLM
- **ChatGPT** : logo noir en mode clair, logo blanc en mode sombre (switch automatique via `dark:hidden`/`hidden dark:block`)
- **Gemini** : logo officiel uploadé (PNG)
- **Claude** : logo officiel uploadé (PNG)
- **Mistral** : logo SVG officiel 2025 uploadé
- **Perplexity** : conservé tel quel

### Lead Magnet Bots IA (`AIBotsLeadMagnet`)
- Composant autonome dans la section LLM de la homepage
- Champ URL avec bordure violette, design minimaliste SaaS premium
- Correction automatique de l'URL via `normalizeUrl()`
- Appel edge function `check-ai-crawlers` pour vérifier l'accès robots.txt
- Résultat affiché en dessous : liste des bots avec statut (✓ autorisé / ✗ bloqué)
- Logique : seul le statut `blocked` explicite affiche une croix rouge ; tout autre statut (`allowed`, `unknown`) affiche un check vert
- Résumé contextuel : "Tous les bots IA peuvent accéder à votre site" ou "N bots IA bloqués"
- Bouton CTA "Audit complet gratuit" redirige vers les outils
- Trilingue FR/EN/ES

### Crawl Multi-Pages (/crawl)
- Bouton flèche retour centré au-dessus de la modal Pro Agency (aligné sur le design /cocoon)
- Notification bandeau noir "pages détectées" supprimée
- Crawls précédents : rapport se déroule inline sans rechargement de page
- En bas du rapport déroulé : boutons "Rapport" et "Cocoon" pour navigation directe
- Le bouton Cocoon transmet l'identifiant du crawl pour pré-charger le bon site dans le sélecteur /cocoon

### Cocoon (/cocoon) — Sélecteur de sites
- Affiche les 5 crawls les plus audités dans Cocoon en priorité
- Barre de recherche en haut du filtre pour retrouver tous les crawls réalisés par l'utilisateur
- Détection automatique du crawl source quand l'utilisateur arrive depuis /crawl
- **Filtres remis à zéro** à chaque nouvelle session et à chaque changement d'URL affichée

## Stack technique

### Langages
| Couche | Langage | Détails |
|--------|---------|---------|
| **Frontend** | TypeScript | React 18 + Vite + Tailwind CSS |
| **Frontend** | CSS | Tailwind utility classes + tokens sémantiques (`index.css`) |
| **Frontend** | HTML | `index.html` (point d'entrée Vite) |
| **Backend (Edge Functions)** | TypeScript | Runtime Deno (toutes les edge functions dans `supabase/functions/`) |
| **Base de données** | SQL (PL/pgSQL) | Migrations, fonctions DB (`score_workbench_priority`, `populate_architect_workbench`, triggers, RLS policies) |

### Résumé
- **TypeScript** est le langage unique partagé entre frontend et backend
- **SQL/PL/pgSQL** pour toute la logique base de données (scoring, triggers, RLS)
- Pas de Python, Ruby, Java ou autre langage serveur
