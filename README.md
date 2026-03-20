# Crawlers.fr — Documentation Technique

> **Dernière mise à jour** : 20 mars 2026  
> **Version** : 2.10.0  
> **Lignes de code** : ~155 000 (Backend: 43 500 · Frontend: 108 000)

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

### 2.1 Edge Functions (95 fonctions + 21 modules partagés)

Organisées en **13 domaines fonctionnels** :

| Domaine | Fonctions | Description |
|---------|-----------|-------------|
| **Audit SEO/GEO** | `check-pagespeed`, `check-crawlers`, `check-geo`, `check-llm`, `check-llm-depth`, `diagnose-hallucination`, `calculate-ias`, `calculate-sov` | Audits techniques, visibilité LLM, détection d'hallucinations |
| **Audit Expert** | `expert-audit`, `audit-expert-seo`, `audit-local-seo`, `audit-strategique-ia`, `audit-compare`, `audit-matrice` | Audits stratégiques multi-dimensions |
| **Cocoon & Maillage** | `calculate-cocoon-logic`, `cocoon-chat`, `calculate-internal-pagerank`, `persist-cocoon-session` | Graphe sémantique, assistant IA, PageRank interne |
| **Crawl & Analyse** | `crawl-site`, `process-crawl-queue`, `fetch-sitemap-tree`, `validate-url` | Crawl multi-pages (max 500), file d'attente |
| **Tracking & SERP** | `fetch-serp-kpis`, `refresh-serp-all`, `refresh-llm-visibility-all`, `calculate-llm-volumes`, `snapshot-audit-impact`, `measure-audit-impact` | Suivi hebdomadaire SEO/GEO, autorité sémantique |
| **Paiement** | `create-checkout`, `create-subscription-session`, `create-credit-checkout`, `create-customer-portal`, `stripe-webhook`, `stripe-actions`, `apply-affiliate`, `apply-referral`, `apply-retention-offer` | Stripe, crédits, affiliation, rétention |
| **Auth & Email** | `auth-actions`, `auth-email-hook`, `send-password-reset`, `send-verification-code`, `verify-email-code`, `check-email-exists`, `process-email-queue`, `ensure-profile` | Authentification, emails transactionnels (PGMQ), suppression/archivage utilisateurs |
| **Injection & SDK** | `serve-client-script`, `process-script-queue`, `generate-corrective-code`, `dry-run-script`, `get-final-script`, `verify-injection`, `widget-connect`, `check-widget-health`, `sdk-status`, `watchdog-scripts` | Scripts correctifs, widget JS, monitoring |
| **Content & Blog** | `generate-blog-from-news`, `fetch-news`, `generate-infotainment`, `rss-feed`, `sitemap` | Génération de contenu, flux RSS |
| **Agents IA** | `agent-cto`, `agent-seo`, `supervisor-actions` | Agents autonomes (CTO, SEO), supervision par Supervisor |
| **Partage** | `share-actions`, `share-report`, `resolve-share`, `track-share-click`, `summarize-report` | Rapports partageables, white-label |
| **Intégrations** | `gsc-auth`, `fetch-ga4-data`, `gmb-actions`, `gtm-actions`, `wpsync`, `scan-wp`, `download-plugin` | Google, GMB, GTM, WordPress |
| **Admin & Utilitaires** | `admin-update-plan`, `view-function-source`, `kill-all-viewers`, `run-backend-tests`, `manage-team`, `aggregate-observatory`, `update-market-trends` | Administration, observatoire, tests |

### 2.2 Modules partagés (`_shared/`)

21 modules réutilisables : `supabaseClient.ts`, `getSiteContext.ts`, `enrichSiteContext.ts`, `silentErrorLogger.ts`, `corsHeaders.ts`, etc.

### 2.3 Base de données

- **~52 tables** PostgreSQL avec RLS
- **160+ migrations** versionnées
- Tables clés : `tracked_sites`, `profiles`, `site_crawls`, `crawl_pages`, `cocoon_sessions`, `analytics_events`, `audit_raw_data`, `domain_data_cache`, `site_script_rules`, `archived_users`, `supervisor_error_log`
- Fonctions DB : `check_fair_use_v2`, `use_credit`, `has_role`, `upsert_analyzed_url`, etc.
- File d'attente email : PGMQ (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`)

### 2.4 Agents IA — Architecture CTO / Supervisor

| Agent | Rôle | Périmètre |
|-------|------|-----------|
| **CTO** | Analyse les erreurs des Edge Functions, propose et déploie des correctifs automatiques | Toutes les fonctions sauf `supervisor-actions` |
| **Supervisor** | Contrôle les actions correctives de CTO : analyse la solution déployée, sa logique, son impact | Revue post-déploiement des correctifs CTO |

- Le CTO **ne peut pas** analyser ni enregistrer les erreurs de Supervisor
- Le Supervisor dispose de son propre **registre d'erreurs** (`supervisor_error_log`) visible en admin
- Le Supervisor valide/invalide les correctifs CTO avec un score de confiance et un verdict

---

## 3. Architecture Frontend

### 3.1 Pages (36 pages)

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

### 3.2 Composants (270+ fichiers, 12 modules)

| Module | Rôle |
|--------|------|
| **Admin/** | Dashboard admin, gestion crawls, registre URLs, analytics, prédictions, registre erreurs Supervisor |
| **Cocoon/** | Graphe 3D (Three.js), assistant IA, rapport, recommandations, tâches |
| **ExpertAudit/** | Dashboard audit, catégories, code correctif, Architecte Génératif, lecteur Spotify (prev/next) |
| **Profile/** | Mes sites, crawls, rapports, wallet, scripts, intégrations, GMB |
| **Blog/** | Articles, carrousel actualités |
| **Lexique/** | Glossaire SEO interactif |
| **Analytics/** | Tracking événements |
| **Support/** | FAQ, chat support |
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

### 4.3 Suivi & Monitoring
- Tracking hebdomadaire automatique (SEO score, GEO score, visibilité LLM, autorité sémantique)
- Intégrations : Google Search Console, Google Analytics 4, Google My Business
- Historique backlinks (DataForSEO)
- Graphiques d'évolution multi-métriques

### 4.4 Système de crédits
- Crédits welcome (25 pour les 1000 premiers inscrits)
- Pro Agency gratuit 6 mois pour les 100 premiers
- Système d'affiliation et parrainage
- Paiement Stripe (abonnements + crédits à la carte)

### 4.5 Onboarding & Inscription
- Segmentation PersonaGate (type d'utilisateur) à l'inscription
- Double champ mot de passe avec indicateur de force (jaune minimum)
- Pré-vérification email : détection des comptes existants avec bannière violette de connexion
- Vérification OTP inline (code 6 chiffres) avec auto-détection et vibration visuelle sur erreur
- Confirmation par lien email avec redirection intelligente (attend l'onglet actif)
- Modal d'inscription contextuelle en mode ouvert (après 60s sur une feature) avec tracking admin (affichages, fermetures, signups abandonnés, emails envoyés)

### 4.6 Gestion utilisateurs (Admin)
- Suppression = archivage complet dans `archived_users` (profil, crédits, plan, branding)
- Suppression effective du compte auth (Supabase Admin API) pour libérer l'email
- Réinscription possible : modal "Welcome Back" proposant la restauration des données
- Interface utilisateurs condensée (sans scroll horizontal), actions au survol
- Session admin auto-expirée après 12h

---

## 5. Sécurité

- **RLS** sur toutes les tables sensibles
- **Rôles** : table `user_roles` avec enum (`admin`, `moderator`, `user`)
- **Fair-use** : `check_fair_use_v2` (limites horaires + journalières)
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
| Stripe | Paiements | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Firecrawl | Crawl de pages web | `FIRECRAWL_API_KEY` |
| OpenRouter | LLM fallback | `OPENROUTER_API_KEY` |
| Cloudflare Turnstile | CAPTCHA | `TURNSTILE_SECRET_KEY` |
| Fly.io Renderer | Rendu PDF/screenshots | `FLY_RENDERER_URL`, `FLY_RENDERER_SECRET` |

---

## 8. Console (/console)

- Header épuré : pas de picto illimité, pas de bouton Console redondant sur /console
- Bouton **Crawl** : icône `Bug` en violet (`text-purple-500`)
- Bouton **Matrice** : mention BETA alignée sur le design Cocoon (texte simple, pas de badge)
- Bouton **API** détaché en bas de la sidebar pour accès direct aux connexions CMS/API
- Accès modules premium conditionné par le statut Pro Agency (sauf Matrice)

---

## 9. Roadmap (Phase de design)

- **CMS Adapters** : Application automatique des recommandations Cocoon via API WordPress, Shopify, Webflow, Wix (voir `docs/cms-adapter-architecture.md`)
- **URL Registry** : Référentiel centralisé `url_registry` pour la déduplication et le cache inter-modules
- **Agents autonomes** : Expansion des agents CTO et SEO pour l'auto-optimisation continue

---

## 10. Conventions de développement

- **Backend** : Routeurs consolidés (ex: `stripe-actions`, `auth-actions`) pour minimiser les cold starts
- **Extraction** : Autorisée uniquement si une fonction dépasse 500 lignes ou est partagée par ≥3 services
- **Frontend** : Composants < 300 lignes, refactoring au-delà
- **Secrets** : Jamais dans le code, toujours via Supabase secrets
- **Types** : `src/integrations/supabase/types.ts` auto-généré, ne pas modifier
- **Fichiers protégés** : `config.toml`, `client.ts`, `types.ts`, `.env` — auto-gérés
