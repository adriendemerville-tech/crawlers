# Crawlers.fr — Documentation Technique

> **Dernière mise à jour** : 8 avril 2026  
> **Version** : 2.15.0  
> **Lignes de code** : ~260 000 (Backend: 96 177 · Frontend: 153 145 · SQL: 10 828)

---

## 1. Vue d'ensemble

**Crawlers.fr** est une plateforme SaaS d'audit SEO, GEO (Generative Engine Optimization) et de visualisation sémantique. Elle permet aux agences et consultants SEO d'analyser, optimiser et monitorer la visibilité de sites web dans les moteurs de recherche traditionnels et les moteurs de réponse IA (ChatGPT, Perplexity, Gemini, etc.).

### Stack technique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Framer Motion · Three.js (Cocoon 3D) · Recharts |
| **Backend** | Supabase Edge Functions (Deno) · PostgreSQL · Lovable Cloud |
| **IA** | Lovable AI Gateway (Gemini, GPT-5) · OpenRouter (fallback) |
| **APIs externes** | DataForSEO · Google PageSpeed · Google Search Console · Google Analytics 4 · Firecrawl · Stripe |
| **Déploiement** | Lovable Cloud (auto-deploy) · Custom domain: crawlers.lovable.app |

---

## 2. Architecture Backend

### 2.1 Edge Functions (216 fonctions + 58 modules partagés)

Organisées en **13 domaines fonctionnels** :

| Domaine | Fonctions | Description |
|---------|-----------|-------------|
| **Audit SEO/GEO** | `check-pagespeed`, `check-crawlers`, `check-geo`, `check-llm`, `check-llm-depth`, `check-eeat`, `check-meta-tags`, `check-images`, `check-robots-indexation`, `check-structured-data`, `check-content-quality`, `check-direct-answer`, `check-backlinks`, `diagnose-hallucination`, `calculate-ias`, `calculate-sov`, `calculate-llm-visibility`, `llm-visibility-lite`, `calculate-llm-volumes`, `browserless-metrics`, `save-audit` | Audits techniques, visibilité LLM, détection d'hallucinations |
| **Audit Expert** | `expert-audit`, `audit-expert-seo`, `audit-local-seo`, `audit-strategique-ia`, `audit-compare`, `audit-matrice`, `parse-doc-matrix`, `parse-matrix-geo`, `parse-matrix-hybrid`, `extract-architect-fields`, `extract-pdf-data` | Audits stratégiques multi-dimensions |
| **Intelligence Stratégique** | `strategic-orchestrator`, `strategic-crawl`, `strategic-market`, `strategic-competitors`, `strategic-synthesis`, `generate-more-keywords`, `generate-target-queries`, `generate-prediction`, `brand-mentions`, `update-market-trends` | Analyse concurrentielle, prédictions, tendances |
| **Cocoon & Maillage** | `calculate-cocoon-logic`, `cocoon-chat`, `cocoon-strategist`, `calculate-internal-pagerank`, `persist-cocoon-session`, `cocoon-auto-linking`, `cocoon-deploy-links`, `cocoon-batch-deploy`, `cocoon-diag-authority`, `cocoon-diag-content`, `cocoon-diag-semantic`, `cocoon-diag-structure`, `cocoon-diag-subdomains`, `content-architecture-advisor` | Graphe sémantique, assistant IA, diagnostics, PageRank interne |
| **Crawl & Analyse** | `crawl-site`, `process-crawl-queue`, `fetch-sitemap-tree`, `validate-url`, `url-structure-analyzer`, `fetch-external-site` | Crawl multi-pages (max 500), file d'attente |
| **Tracking & SERP** | `fetch-serp-kpis`, `refresh-serp-all`, `refresh-llm-visibility-all`, `snapshot-audit-impact`, `measure-audit-impact`, `detect-anomalies`, `drop-detector`, `content-freshness`, `content-pruning`, `content-perf-aggregator`, `backlink-scanner`, `seasonality-detector`, `auto-measure-predictions` | Suivi hebdomadaire SEO/GEO, autorité sémantique, détection d'anomalies |
| **Paiement** | `create-checkout`, `create-subscription-session`, `create-credit-checkout`, `create-customer-portal`, `stripe-webhook`, `stripe-actions`, `apply-affiliate`, `apply-referral`, `apply-retention-offer`, `track-payment`, `dataforseo-balance`, `api-balances` | Stripe, crédits, affiliation, rétention |
| **Auth & Email** | `auth-actions`, `auth-email-hook`, `send-password-reset`, `send-verification-code`, `verify-email-code`, `process-email-queue`, `ensure-profile`, `delete-account`, `restore-archived-user`, `verify-turnstile` | Authentification, emails transactionnels (PGMQ), suppression/archivage utilisateurs |
| **Injection & SDK** | `serve-client-script`, `process-script-queue`, `generate-corrective-code`, `dry-run-script`, `get-final-script`, `verify-injection`, `widget-connect`, `check-widget-health`, `sdk-status` | Scripts correctifs, widget JS, monitoring |
| **Content & Blog** | `generate-blog-from-news`, `fetch-news`, `generate-infotainment`, `rss-feed`, `sitemap` | Génération de contenu, flux RSS |
| **Agents IA** | `agent-cto`, `agent-seo`, `supervisor-actions`, `sav-agent`, `felix-seo-quiz`, `felix-weekly-quiz-notif`, `sync-quiz-crawlers`, `normalize-quiz-options` | Agents autonomes (CTO, SEO, Félix), supervision, quiz SEO |
| **Autopilote** | `parmenion-orchestrator`, `parmenion-feedback`, `autopilot-engine` | Orchestration Parménion, feedback loop |
| **CMS Adapters** | `cms-push-code`, `cms-push-draft`, `cms-publish-draft`, `cms-patch-content`, `cms-push-redirect`, `register-cms-webhook`, `wpsync`, `scan-wp`, `download-plugin`, `rankmath-actions`, `linkwhisper-actions`, `drupal-actions`, `prestashop-connector`, `odoo-connector`, `matomo-connector`, `iktracker-actions`, `webhook-shopify-orders`, `webhook-woo-orders` | Déploiement universel sur 7 CMS |
| **Intégrations Google** | `gsc-auth`, `fetch-ga4-data`, `gmb-actions`, `gmb-local-competitors`, `gmb-optimization`, `gmb-places-autocomplete`, `gtm-actions`, `google-ads-connector`, `serpapi-actions`, `gtmetrix-actions`, `haloscan-connector` | Google (GSC, GA4, GMB, GTM, Ads), HaloScan |
| **Partage** | `share-actions`, `share-report`, `resolve-share`, `track-share-click`, `summarize-report`, `robots-generator` | Rapports partageables, white-label |
| **Admin & Utilitaires** | `admin-update-plan`, `admin-backend-query`, `view-function-source`, `kill-all-viewers`, `manage-team`, `aggregate-observatory`, `update-config`, `health-check`, `fly-health-check`, `fly-keepalive`, `track-analytics`, `submit-bug-report`, `archive-solution` | Administration, observatoire, monitoring |
| **Prospection** | `marina`, `voice-identity-enrichment`, `link-intersection`, `broken-link-building` | Pipeline autonome, enrichissement vocal, link building |
| **MCP & Firehose** | `mcp-server`, `firehose-actions` | Serveur MCP (Model Context Protocol), événements temps réel |

### 2.2 Modules partagés (`_shared/`)

58 modules réutilisables : `supabaseClient.ts`, `getSiteContext.ts`, `enrichSiteContext.ts`, `identityGateway.ts`, `getDomainContext.ts`, `siteMemory.ts`, `lovableAI.ts`, `fairUse.ts`, `auditCache.ts`, `silentErrorLogger.ts`, `corsHeaders.ts`, `stealthFetch.ts`, `strategicPrompts.ts`, `contentBrief.ts`, `tokenTracker.ts`, `circuitBreaker.ts`, `preCrawlForAudit.ts`, `serveHandler.ts`, `naturalPrompts.ts`, `resolveGoogleToken.ts`, etc.

### 2.3 Base de données

- **~181 tables** PostgreSQL avec RLS
- **311 migrations** versionnées
- Tables clés : `tracked_sites`, `profiles`, `site_crawls`, `crawl_pages`, `cocoon_sessions`, `analytics_events`, `audit_raw_data`, `domain_data_cache`, `site_script_rules`, `archived_users`, `supervisor_logs`, `marina_training_data`, `architect_workbench`, `parmenion_decision_log`, `identity_card_suggestions`, `autopilot_configs`, `autopilot_modification_log`
- Fonctions DB : `check_fair_use_v2`, `check_monthly_fair_use`, `use_credit`, `has_role`, `upsert_analyzed_url`, `score_workbench_priority`, `populate_architect_workbench`, `parmenion_error_rate`, `parmenion_recent_errors`, `atomic_credit_update`, `get_team_accessible_sites`, etc.
- File d'attente email : PGMQ (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`)

### 2.4 Agents IA — Architecture CTO / Supervisor

| Agent | Rôle | Périmètre |
|-------|------|-----------|
| **CTO** | Analyse les erreurs des Edge Functions, propose et déploie des correctifs automatiques | Toutes les fonctions sauf `supervisor-actions` |
| **Supervisor** | Contrôle les actions correctives de CTO : analyse la solution déployée, sa logique, son impact | Revue post-déploiement des correctifs CTO |
| **Félix (SAV)** | Agent conversationnel SEO, quiz hebdomadaire, mémoire contextuelle par site, workflow post-audit guidé (résumé → priorités → actions) | Interactions utilisateurs, support SEO |
| **Agent SEO** | Agent autonome d'optimisation SEO continue | Suivi interne (crawlers.fr), différé pour les sites clients |
| **Parménion** | Orchestrateur autopilote en 5 phases : diagnostic → prescription → implémentation → mesure → calibration | Déploiement CMS universel via 4 canaux (code, data, content, editorial) |

- Le CTO **ne peut pas** analyser ni enregistrer les erreurs de Supervisor
- Le Supervisor dispose de son propre **registre d'erreurs** (`supervisor_logs`) visible en admin
- Le Supervisor valide/invalide les correctifs CTO avec un score de confiance et un verdict
- Parménion utilise le **Workbench** (`architect_workbench`) comme source de tâches priorisées
- **Cooldown Parménion** : appliqué uniquement entre macro-cycles réussis (2h par défaut). Pas de cooldown après un cycle échoué — retry immédiat au prochain cron (10 min)

### 2.5 Carte d'Identité (Identity Gateway)

Architecture centralisée via `_shared/identityGateway.ts`, unique point d'écriture pour la carte d'identité des sites (`tracked_sites`).

| Règle | Description |
|-------|-------------|
| **Whitelist** | Seuls les champs enregistrés sont acceptés (critiques + mineurs) |
| **Protection source** | Les données `user_manual`/`user_voice` ne sont jamais écrasées par le LLM |
| **Mode hybride** | Champs critiques existants → suggestion ; champs mineurs → update direct |
| **Confidence** | Recalcul automatique du score de confiance après chaque écriture |

**Sources d'écriture** : `enrichSiteContext`, `voice-identity-enrichment`, `siteMemory`, `expert-audit` (CMS), `marina`, `cocoon-strategist`, `seasonality-detector`, `audit-strategique-ia`

**Lecteurs** (via `getSiteContext`) : `audit-strategique-ia`, `content-architecture-advisor`, `generate-prediction`, `detect-anomalies`, `cocoon-strategist`, `content-freshness`, `content-pruning`, `drop-detector`, `backlink-scanner`, `parmenion-orchestrator`, `check-llm`, `calculate-sov`, `sav-agent`, `check-eeat`

### 2.6 Scoring E-E-A-T (v2 — weighted_algorithmic)

Le score E-E-A-T utilise un calcul pondéré algorithmique (le LLM évalue les 4 piliers individuellement, le score global est calculé mathématiquement) :

| Pilier | Poids | Description |
|--------|-------|-------------|
| **Trustworthiness** | ×4.0 | Pilier dominant — HTTPS, mentions légales, citations, âge du domaine |
| **Expertise** | ×2.5 | Compétence technique, profondeur du contenu |
| **Authoritativeness** | ×2.5 | Reconnaissance externe, backlinks (DataForSEO + GA4 referrals) |
| **Experience** | ×1.5 | Preuves de vécu terrain, témoignages, cas concrets |

**Formule** : `overall = (E×1.5 + Ex×2.5 + A×2.5 + T×4) / 10.5`

**Pénalités Trustworthiness** (appliquées avant le calcul) :
- Aucune citation externe / aucun lien sortant : **-15 pts**
- Domaine < 2 ans (via `founding_year` de la carte d'identité, fallback Wayback Machine) : **-10 pts**
- Pas de HTTPS : **-20 pts**

**Sources de données** : crawl HTML multi-pages, LLM sémantique, DataForSEO backlinks, GA4 referrals, Google Business Profile, Wayback Machine (âge domaine).

---

## 3. Architecture Frontend

### 3.1 Pages (51 pages)

| Catégorie | Pages |
|-----------|-------|
| **Landing & Marketing** | `Index`, `ProAgency`, `Tarifs`, `Faq`, `Methodologie`, `Observatoire` |
| **Audit & Analyse** | `ExpertAudit`, `SiteCrawl`, `AuditCompare`, `AuditSeoGratuit`, `AnalyseSiteWebGratuit`, `MatricePrompt`, `RapportMatrice` |
| **Cocoon** | `Cocoon`, `FeaturesCocoon` |
| **Outils** | `ArchitecteGeneratif`, `GenerativeEngineOptimization`, `IndiceAlignementStrategique`, `IntegrationGTM`, `ModifierCodeWordPress` |
| **Profil & Compte** | `Profile`, `Auth`, `Signup`, `ResetPassword` |
| **Contenu** | `Lexique`, `GuideAuditSeo`, `ComparatifCrawlersSemrush` |
| **Rapports** | `ReportViewer`, `RapportViewer`, `SharedReportRedirect` |
| **Légal** | `CGVU`, `RGPD`, `MentionsLegales`, `PolitiqueConfidentialite`, `ConditionsUtilisation` |

### 3.2 Composants (369+ fichiers, 13 modules)

| Module | Rôle |
|--------|------|
| **Admin/** | Dashboard admin, gestion crawls, registre URLs, analytics, prédictions, registre erreurs Supervisor, Marina (pipeline prospection), E-E-A-T scoring admin |
| **Cocoon/** | Graphe 3D (Three.js), assistant IA, rapport, recommandations, tâches |
| **ExpertAudit/** | Dashboard audit, catégories, code correctif, Architecte Génératif, lecteur Spotify (prev/next) |
| **Profile/** | Mes sites, crawls, rapports, wallet, scripts, intégrations, GMB |
| **Blog/** | Articles, carrousel actualités |
| **Lexique/** | Glossaire SEO interactif |
| **Analytics/** | Tracking événements |
| **Support/** | FAQ, chat support, Félix (assistant IA avec workflow post-audit) |
| **ui/** | Composants shadcn/ui personnalisés |

### 3.3 Contextes React

- `AuthContext` — Authentification utilisateur
- `LanguageContext` — i18n (FR, EN, ES)
- `CreditsContext` — Solde crédits temps réel
- `ThemeProvider` — Dark/Light mode
- `AdminContext` — Droits admin (readOnly, canSeeDocs, canSeeAlgos, isAuditor)

---

## 4. Fonctionnalités clés

### 4.1 Cocoon Sémantique
- Visualisation 3D/2D du graphe de maillage interne
- Calcul TF-IDF enrichi par segments URL et ancres
- Assistant IA (Gemini 3 Flash) avec accès aux données complètes du domaine (crawl, audit, SERP, backlinks, GSC, GA4)
- Historique des recommandations + plan de tâches
- Rapport exportable (PDF/CSV) avec white-labeling
- Limite : 100 pages max pour le graphe, 500 pour le crawl

### 4.2 Audit Expert
- Audit technique (PageSpeed, crawlers IA, sécurité, structure)
- Audit stratégique (E-E-A-T, positionnement, autorité de marque, feuille de route IA)
- Audit local SEO (GMB, NAP, avis)
- Code correctif généré par IA (JSON-LD, meta, robots.txt)
- Architecte Génératif : injection de scripts via widget JS
- Lecteur Spotify intégré avec contrôles prev/play/next

### 4.3 Audit E-E-A-T (v2)
- Scoring pondéré algorithmique : Trustworthiness ×4, Expertise ×2.5, Authoritativeness ×2.5, Experience ×1.5
- Pénalités automatiques sur Trustworthiness : absence citations (-15), domaine jeune (-10), pas HTTPS (-20)
- Enrichissement multi-sources : crawl HTML, DataForSEO backlinks, GA4 referrals, Google Business Profile
- Détection automatique de l'âge du domaine via carte d'identité + fallback Wayback Machine
- Rapport avec décomposition visuelle des contributions par pilier

### 4.4 Suivi & Monitoring
- Tracking hebdomadaire automatique (SEO score, GEO score, visibilité LLM, autorité sémantique)
- Intégrations : Google Search Console, Google Analytics 4, Google My Business
- Historique backlinks (DataForSEO)
- Graphiques d'évolution multi-métriques

### 4.5 Parménion (Autopilote)
- Orchestrateur en 5 phases : diagnostic → prescription → implémentation → mesure → calibration
- **Cooldown macro-cycle** : 2h entre deux macro-cycles réussis. Pas de cooldown après un cycle échoué — retry immédiat au prochain intervalle cron (10 min)
- Workbench comme source de tâches priorisées avec scoring multi-critères (`score_workbench_priority`)
- Déploiement CMS universel via 4 canaux (code, data, content, editorial)

### 4.6 Félix — Workflow post-audit
- Après un audit (Expert ou Matrice), Félix propose un résumé des résultats en mode fenêtre toute hauteur
- Flux guidé : résumé → classement par priorité → choix de priorité via boutons → solutions du workbench → proposition d'action (Content/Code Architect) → mise à jour du plan d'action
- Lecture du `architect_workbench` avec traçabilité des sources (`source_type`, `source_function`)

### 4.7 Système de crédits
- Crédits welcome (25 pour les 1000 premiers inscrits)
- Pro Agency gratuit 6 mois pour les 100 premiers
- Système d'affiliation et parrainage
- Paiement Stripe (abonnements + crédits à la carte)

### 4.8 Onboarding & Inscription
- Segmentation PersonaGate (type d'utilisateur) à l'inscription
- Double champ mot de passe avec indicateur de force (jaune minimum)
- Pré-vérification email : détection des comptes existants avec bannière violette de connexion
- Vérification OTP inline (code 6 chiffres) avec auto-détection et vibration visuelle sur erreur
- Confirmation par lien email avec redirection intelligente (attend l'onglet actif)
- Modal d'inscription contextuelle en mode ouvert (après 60s sur une feature) avec tracking admin (affichages, fermetures, signups abandonnés, emails envoyés)

### 4.9 Gestion utilisateurs (Admin)
- **Suppression dédiée** : Edge Function `delete-account` en 4 étapes :
  1. Archivage complet dans `archived_users` (profil, crédits, plan, branding, snapshot)
  2. Nettoyage exhaustif de **60+ tables** dans l'ordre des dépendances FK (leaves → parents)
  3. Suppression du compte `auth.users` pour libérer définitivement l'email
  4. Vérification post-suppression (profile, auth, tracked_sites) avec rapport d'anomalies
- Aucun faux positif : un email archivé ne remonte plus comme « déjà inscrit »
- Réinscription possible : modal "Welcome Back" proposant la restauration des données
- Interface utilisateurs condensée (sans scroll horizontal), actions au survol
- Session admin auto-expirée après 12h

---

## 5. Sécurité

- **RLS** sur toutes les tables sensibles
- **Rôles** : table `user_roles` avec enum (`admin`, `moderator`, `user`)
- **Fair-use** : `check_fair_use_v2` (limites horaires + journalières) + `check_monthly_fair_use`
- **Rate limiting** : `check_rate_limit` par action
- **Protection profils** : triggers `protect_profile_fields` et `protect_billing_fields`
- **Tokens OAuth** : stockage chiffré (Google, CMS)
- **Turnstile** : vérification CAPTCHA Cloudflare sur les formulaires publics
- **Session admin** : TTL 12h avec déconnexion automatique
- **Archivage** : les utilisateurs supprimés sont archivés, jamais perdus

---

## 6. Internationalisation

- 3 langues : Français (défaut), Anglais, Espagnol
- Traductions inline dans chaque composant via objets `translations`
- L'assistant IA adapte sa langue automatiquement

---

## 7. Intégrations externes

| Service | Usage | Secret(s) |
|---------|-------|-----------|
| DataForSEO | SERP, backlinks, keywords | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` |
| Google PageSpeed | Core Web Vitals | `GOOGLE_PAGESPEED_API_KEY` |
| Google OAuth (GSC/GA4) | Search Console, Analytics | `GOOGLE_GSC_CLIENT_ID`, `GOOGLE_GSC_CLIENT_SECRET` |
| Google Places | GMB autocomplete | `GOOGLE_PLACES_API_KEY` |
| Stripe | Paiements | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Firecrawl | Crawl de pages web | `FIRECRAWL_API_KEY` |
| Spider | Crawl alternatif | `SPIDER_API_KEY` |
| OpenRouter | LLM fallback | `OPENROUTER_API_KEY` |
| SerpAPI | SERP alternatif | `SERPAPI_KEY` |
| HaloScan | Monitoring SEO | via `haloscan-connector` |
| GTmetrix | Performance avancée | via `gtmetrix-actions` |
| Cloudflare Turnstile | CAPTCHA | `TURNSTILE_SECRET_KEY` |
| Fly.io Renderer | Rendu PDF/screenshots | `FLY_RENDERER_URL`, `FLY_RENDERER_SECRET` |
| IKTracker | Tracking injection | `IKTRACKER_API_KEY` |

---

## 8. Console (/console)

- Header épuré : pas de picto illimité, pas de bouton Console redondant sur /console
- Bouton **Crawl** : icône `Bug` en violet (`text-purple-500`)
- Bouton **Matrice** : mention BETA alignée sur le design Cocoon (texte simple, pas de badge)
- Bouton **API** détaché en bas de la sidebar pour accès direct aux connexions CMS/API
- Accès modules premium conditionné par le statut Pro Agency (sauf Matrice)

---

## 9. Roadmap (Phase de design)

- **CMS Adapters** : Déploiement universel sur 7 CMS (WordPress, Shopify, Wix, Drupal, Webflow, PrestaShop, Odoo) via 4 fonctions (`cms-push-code`, `cms-push-draft`, `cms-patch-content`, `cms-push-redirect`)
- **URL Registry** : Référentiel centralisé `url_registry` pour la déduplication et le cache inter-modules
- **Agents autonomes** : Expansion des agents CTO et SEO pour l'auto-optimisation continue
- **Identity Gateway** : Branchement progressif de toutes les fonctions sur la carte d'identité centralisée

---

## 10. Conventions de développement

- **Backend** : Routeurs consolidés (ex: `stripe-actions`, `auth-actions`) pour minimiser les cold starts
- **Extraction** : Autorisée uniquement si une fonction dépasse 500 lignes ou est partagée par ≥3 services
- **Frontend** : Composants < 300 lignes, refactoring au-delà
- **Secrets** : Jamais dans le code, toujours via Supabase secrets
- **Types** : `src/integrations/supabase/types.ts` auto-généré, ne pas modifier
- **Fichiers protégés** : `config.toml`, `client.ts`, `types.ts`, `.env` — auto-gérés
