/**
 * ============================================================
 * DOCUMENTATION TECHNIQUE DU BACKEND
 * ============================================================
 * 
 * CE FICHIER CONTIENT TOUTE LA DOCUMENTATION STRUCTURÉE.
 * 
 * POUR METTRE À JOUR LA DOCUMENTATION :
 * 1. Modifiez le contenu Markdown dans les propriétés `content` ci-dessous.
 * 2. Ajoutez de nouvelles sections en ajoutant un objet au tableau `sections`.
 * 3. Les blocs de code utilisent la syntaxe Markdown standard :
 *    ```typescript
 *    // votre code ici
 *    ```
 * 4. Les tableaux utilisent la syntaxe Markdown standard :
 *    | Colonne 1 | Colonne 2 |
 *    |-----------|-----------|
 *    | Valeur    | Valeur    |
 * 
 * STRUCTURE : Chaque section a un `id`, `title`, `icon` (nom Lucide), et `content` (Markdown).
 * ============================================================
 */

export interface DocSection {
  id: string;
  title: string;
  icon: string; // Lucide icon name
  content: string;
}

export const backendDocSections: DocSection[] = [
  // ───────────────────────────────────────────────
  // SECTION 1 : ARCHITECTURE GLOBALE
  // ───────────────────────────────────────────────
  {
    id: 'architecture',
    title: 'Architecture Globale',
    icon: 'Network',
    content: `
# Architecture Globale

## Vue d'ensemble

Le projet est une plateforme SaaS d'audit SEO / GEO / LLM construite sur une architecture **serverless edge-first** :

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React/Vite)                   │
│  SPA avec lazy-loading, React Query, Supabase JS SDK    │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS (Deno)             │
│  79+ fonctions serverless déployées sur ~30 PoPs         │
│  - Audit engines (SEO, GEO, LLM, PageSpeed)             │
│  - Crawl engine (Firecrawl + processing queue)           │
│  - AI pipelines (Gemini, GPT via Lovable AI)             │
│  - Stripe billing, Auth, Analytics                       │
└────────────────────────┬────────────────────────────────┘
                         │ PostgREST / SQL
┌────────────────────────▼────────────────────────────────┐
│              SUPABASE POSTGRESQL                        │
│  40+ tables avec RLS, fonctions PL/pgSQL, triggers      │
│  Schémas : public (app), auth (Supabase), storage       │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Stack Technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Frontend | React 18 + Vite + TypeScript | SPA avec SSR-like SEO (Helmet) |
| UI | Tailwind CSS + shadcn/ui + Framer Motion | Design system avec tokens sémantiques |
| State | React Query + Context API | Cache serveur + état global auth/crédits |
| Backend | Supabase Edge Functions (Deno) | 79 fonctions serverless |
| Database | PostgreSQL 15 (Supabase) | RLS, triggers, fonctions SQL |
| Auth | Supabase Auth | Email/password, magic links |
| Storage | Supabase Storage | Logos agence, PDFs |
| Payments | Stripe | Abonnements, crédits, webhooks |
| AI | Lovable AI (Gemini/GPT) | Audits stratégiques, génération de contenu |
| Crawling | Firecrawl API | Map + scrape multi-pages |
| Anti-détection | StealthFetch (custom) | User-Agent rotation, headers, retries |

## Flux de données principal

1. **L'utilisateur soumet une URL** → Le frontend appelle une Edge Function
2. **L'Edge Function** effectue le scraping (via StealthFetch/Firecrawl), l'analyse IA, et retourne les résultats
3. **Les résultats sont cachés** dans \`audit_cache\` (TTL configurable) et optionnellement sauvegardés dans \`saved_reports\`
4. **Le système de crédits** (\`use_credit\` RPC) débite l'utilisateur avant chaque opération payante
5. **Les webhooks Stripe** mettent à jour \`profiles.subscription_status\` et créditent les achats

## Patterns architecturaux

- **Cache-first** : Toutes les fonctions d'audit vérifient \`audit_cache\` avant d'exécuter (via \`_shared/auditCache.ts\`)
- **Fire-and-forget workers** : Le crawl multi-pages lance un job puis déclenche le worker de manière asynchrone
- **Token tracking** : Chaque appel API externe est tracké dans \`api_call_logs\` (via \`_shared/tokenTracker.ts\`)
- **SSRF protection** : Toutes les URLs utilisateur sont validées contre les IPs privées (via \`_shared/ssrf.ts\`)
`,
  },

  // ───────────────────────────────────────────────
  // SECTION 2 : BASE DE DONNÉES
  // ───────────────────────────────────────────────
  {
    id: 'database',
    title: 'Base de Données',
    icon: 'Database',
    content: `
# Schéma de Base de Données

## Tables principales

### Utilisateurs & Auth

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`profiles\` | Profil utilisateur étendu | \`user_id\`, \`email\`, \`plan_type\`, \`credits_balance\`, \`subscription_status\`, champs marque blanche (agency_*) |
| \`user_roles\` | Rôles applicatifs (RBAC) | \`user_id\`, \`role\` (enum: admin/créateur, viewer, viewer_level2, moderator, user) |
| \`billing_info\` | Informations de facturation | \`user_id\`, \`stripe_customer_id\`, \`vat_number\`, adresse |
| \`credit_transactions\` | Historique des transactions | \`user_id\`, \`amount\`, \`transaction_type\`, \`stripe_session_id\` |

### Audits & Rapports

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`audits\` | Audits payants (code correctif) | \`url\`, \`domain\`, \`dynamic_price\`, \`payment_status\`, \`generated_code\` |
| \`saved_reports\` | Rapports sauvegardés | \`user_id\`, \`url\`, \`report_type\` (enum), \`report_data\` (JSON), \`folder_id\` |
| \`report_folders\` | Organisation en dossiers | \`user_id\`, \`name\`, \`parent_id\`, \`position\` |
| \`audit_cache\` | Cache des résultats d'audit | \`cache_key\`, \`function_name\`, \`result_data\`, \`expires_at\` |
| \`action_plans\` | Plans d'action générés | \`user_id\`, \`url\`, \`audit_type\`, \`tasks\` (JSON) |

### Crawl Engine

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`site_crawls\` | Sessions de crawl | \`user_id\`, \`domain\`, \`status\`, \`total_pages\`, \`credits_used\` |
| \`crawl_jobs\` | Jobs de processing | \`crawl_id\`, \`urls_to_process\` (JSON), \`status\`, \`max_depth\`, \`url_filter\` |
| \`crawl_pages\` | Pages analysées | \`crawl_id\`, \`url\`, \`seo_score\`, \`http_status\`, \`title\`, \`meta_description\`, maillage, images, schema.org |

### Tracking & Analytics

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`tracked_sites\` | Sites suivis (monitoring) | \`user_id\`, \`url\`, \`domain\`, \`check_frequency\` |
| \`analytics_events\` | Événements utilisateur | \`event_type\`, \`url\`, \`session_id\`, \`event_data\` (JSON) |
| \`analyzed_urls\` | Index des URLs analysées | \`url\`, \`domain\`, \`analysis_count\` |

### IA & Prédictions

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`predictions\` | Prédictions de trafic | \`audit_id\`, \`baseline_traffic\`, \`predicted_traffic\`, \`predicted_increase_pct\` |
| \`actual_results\` | Résultats réels (validation) | \`prediction_id\`, \`real_traffic_after_90_days\`, \`accuracy_gap\` |
| \`cto_agent_logs\` | Logs de l'Agent CTO | \`function_analyzed\`, \`decision\`, \`confidence_score\`, \`proposed_change\` |
| \`prompt_registry\` | Registre des prompts versionnés | \`function_name\`, \`prompt_text\`, \`version\`, \`is_champion\` |
| \`hallucination_corrections\` | Corrections d'hallucinations | \`url\`, \`original_values\`, \`corrected_values\`, \`discrepancies\` |

### Agence (Marque Blanche)

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`agency_clients\` | Clients de l'agence | \`owner_user_id\`, \`first_name\`, \`last_name\`, \`company\` |
| \`agency_team_members\` | Membres de l'équipe | \`owner_user_id\`, \`member_user_id\`, \`role\` |
| \`agency_invitations\` | Invitations d'équipe | \`token\`, \`email\`, \`role\`, \`status\`, \`expires_at\` |

## Relations clés

\`\`\`
profiles.user_id ──────→ auth.users.id (1:1)
user_roles.user_id ────→ auth.users.id (N:1)
saved_reports.folder_id → report_folders.id (N:1)
crawl_jobs.crawl_id ───→ site_crawls.id (N:1)
crawl_pages.crawl_id ──→ site_crawls.id (N:1)
predictions.audit_id ──→ pdf_audits.id (N:1)
actual_results.prediction_id → predictions.id (N:1)
\`\`\`

## Fonctions SQL importantes

| Fonction | Type | Description |
|----------|------|-------------|
| \`use_credit(p_user_id, p_amount, p_description)\` | RPC | Débite les crédits de manière atomique |
| \`has_role(_user_id, _role)\` | SECURITY DEFINER | Vérifie un rôle sans récursion RLS |
| \`handle_new_user()\` | Trigger | Crée un profil automatiquement à l'inscription |

## Row-Level Security (RLS)

Toutes les tables utilisateur ont RLS activé. Patterns :
- **Isolation utilisateur** : \\\`auth.uid() = user_id\\\`
- **Admin bypass** : via \\\`has_role(auth.uid(), 'admin')\\\`
- **Données publiques** : \\\`patience_cards\\\`, \\\`market_trends\\\` (lecture publique)

## Système de rôles (RBAC)

| Rôle DB | Label UI | Droits |
|---------|----------|--------|
| \\\`admin\\\` | **Créateur** | Accès total : lecture, écriture, configuration, gestion des rôles |
| \\\`viewer\\\` | **Viewer** | Dashboard en lecture seule. Tous les onglets (sauf si docs masquées). Actions désactivées front + serveur |
| \\\`viewer_level2\\\` | **Viewer L2** | Comme viewer mais **sans** Docs ni Algos ML |

### Sécurité des rôles

- Rôles stockés dans \\\`user_roles\\\` (table séparée, jamais sur \\\`profiles\\\`)
- Fonction \\\`has_role()\\\` (SECURITY DEFINER) empêche la récursion RLS
- Les edge functions vérifient \\\`has_role(uid, 'admin')\\\` côté serveur
- Le Créateur peut masquer la documentation pour tous les viewers via toggle
`,
  },

  // ───────────────────────────────────────────────
  // SECTION 3 : API / ENDPOINTS
  // ───────────────────────────────────────────────
  {
    id: 'api',
    title: 'API / Endpoints',
    icon: 'Plug',
    content: `
# API — Edge Functions

Toutes les fonctions sont accessibles via \`POST https://<project>.supabase.co/functions/v1/<nom>\`.

## Audit & Analyse

| Endpoint | Auth | Crédits | Description |
|----------|------|---------|-------------|
| \`validate-url\` | ❌ | 0 | Valide et normalise une URL |
| \`check-crawlers\` | ❌ | 0 | Analyse robots.txt et accessibilité bots |
| \`check-geo\` | ❌ | 0 | Audit GEO (Generative Engine Optimization) |
| \`check-llm\` | ❌ | 0 | Visibilité dans les LLMs (ChatGPT, Gemini…) |
| \`check-pagespeed\` | ❌ | 0 | Métriques Core Web Vitals via Google PSI |
| \`expert-audit\` | ✅ | 1 | Audit expert complet (score /200) |
| \`audit-expert-seo\` | ✅ | 2 | Audit SEO technique approfondi |
| \`audit-strategique-ia\` | ✅ | 3 | Audit stratégique IA (Gemini) |
| \`audit-compare\` | ✅ | 2 | Comparaison avant/après |
| \`audit-local-seo\` | ✅ | 1 | Audit SEO local |
| \`diagnose-hallucination\` | ✅ | 1 | Diagnostic d'hallucination LLM |

## Crawl Engine

| Endpoint | Auth | Crédits | Description |
|----------|------|---------|-------------|
| \`crawl-site\` | ✅ | 5-30 | Lance un crawl multi-pages |
| \`process-crawl-queue\` | ✅ | 0 | Worker de traitement des jobs |
| \`scan-wp\` | ✅ | 1 | Scan WordPress (plugins, thème, sécu) |

## Génération & IA

| Endpoint | Auth | Crédits | Description |
|----------|------|---------|-------------|
| \`generate-corrective-code\` | ✅ | 2 | Génère le code correctif JS |
| \`get-final-script\` | ✅ | 0 | Récupère le script final validé |
| \`generate-target-queries\` | ✅ | 1 | Génère des requêtes cibles LLM |
| \`generate-more-keywords\` | ✅ | 1 | Extension de mots-clés |
| \`generate-infotainment\` | ✅ | 0 | Contenu de patience (loading) |
| \`generate-blog-from-news\` | ✅ | 0 | Génération d'articles de blog |
| \`generate-prediction\` | ✅ | 0 | Prédiction de trafic |
| \`summarize-report\` | ✅ | 0 | Résumé IA d'un rapport |

## Utilisateur & Billing

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`ensure-profile\` | ✅ | Crée le profil si inexistant |
| \`create-checkout\` | ✅ | Session Stripe pour achat audit |
| \`create-credit-checkout\` | ✅ | Session Stripe pour achat crédits |
| \`create-subscription-session\` | ✅ | Session Stripe pour abonnement |
| \`create-customer-portal\` | ✅ | Portail client Stripe |
| \`stripe-webhook\` | ❌ | Webhook Stripe (signature vérifié) |
| \`apply-referral\` | ✅ | Applique un code de parrainage |
| \`manage-team\` | ✅ | Gestion équipe agence |

## Partage & Export

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`share-report\` | ✅ | Crée un lien de partage temporaire |
| \`resolve-share\` | ❌ | Résout un lien de partage |
| \`track-share-click\` | ❌ | Compteur de clics partage |
| \`save-audit\` | ✅ | Sauvegarde un audit |
| \`download-plugin\` | ✅ | Télécharge le plugin WordPress |

## Divers

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`track-analytics\` | ❌ | Tracking événements analytics |
| \`fetch-news\` | ❌ | Récupère les actualités SEO |
| \`fetch-external-site\` | ✅ | Proxy HTML pour analyse |
| \`agent-cto\` | ✅ | Agent CTO autonome |
| \`aggregate-observatory\` | ✅ | Agrégation observatoire sectoriel |
| \`calculate-llm-volumes\` | ✅ | Calcul volumes LLM |
| \`measure-audit-impact\` | ✅ | Mesure d'impact post-audit |
| \`snapshot-audit-impact\` | ✅ | Snapshot T+30/60/90 |
| \`update-market-trends\` | ✅ | MAJ tendances marché |
| \`sdk-status\` | ❌ | Statut du SDK widget |
| \`sitemap\` | ❌ | Génération sitemap XML |
| \`rss-feed\` | ❌ | Flux RSS du blog |
| \`verify-turnstile\` | ❌ | Vérification Cloudflare Turnstile |
| \`widget-connect\` | ❌ | Connexion du widget externe |
| \`wpsync\` | ✅ | Synchronisation WordPress |

## Exemple de requête

\`\`\`bash
curl -X POST \\
  https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/check-geo \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <anon_key>" \\
  -d '{"url": "https://example.com"}'
\`\`\`

## Exemple de réponse (check-geo)

\`\`\`json
{
  "success": true,
  "scores": {
    "global": 72,
    "technical": 85,
    "content": 68,
    "authority": 63
  },
  "recommendations": [
    {
      "category": "technical",
      "priority": "high",
      "title": "Ajouter des données structurées FAQ",
      "description": "..."
    }
  ]
}
\`\`\`
`,
  },

  // ───────────────────────────────────────────────
  // SECTION 4 : MOTEUR DE CRAWL
  // ───────────────────────────────────────────────
  {
    id: 'crawl-engine',
    title: 'Moteur de Crawl',
    icon: 'Bug',
    content: `
# Moteur de Crawl

## Architecture du crawl

Le crawl multi-pages fonctionne en **3 phases** :

\`\`\`
Phase 1: MAPPING         Phase 2: QUEUING          Phase 3: PROCESSING
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  crawl-site     │     │  crawl_jobs      │     │ process-crawl-    │
│  (Edge Fn)      │────→│  (table DB)      │────→│ queue (Worker)    │
│                 │     │                  │     │                   │
│ • Firecrawl /map│     │ • urls_to_process│     │ • Batch de 5 URLs │
│ • Filtre regex  │     │ • max_depth      │     │ • Firecrawl /scrape│
│ • Débit crédits │     │ • custom_selectors│    │ • Analyse SEO     │
└─────────────────┘     └──────────────────┘     └───────────────────┘
\`\`\`

## Flux détaillé

### 1. Lancement (\`crawl-site\`)

\`\`\`typescript
// Paramètres acceptés
{
  url: string,           // URL de départ (obligatoire)
  userId: string,        // ID utilisateur (obligatoire)
  maxPages: number,      // Max 500, défaut 50
  maxDepth: number,      // Profondeur de crawl, défaut 0 (illimité)
  urlFilter: string,     // Regex pour filtrer les URLs
  customSelectors: []    // Sélecteurs CSS pour extraction custom
}
\`\`\`

- Vérifie les crédits (\`use_credit\` RPC)
- Pro Agency / Admin = crawl illimité (0 crédits)
- Appelle Firecrawl \`/map\` pour découvrir les URLs
- Filtre par regex si \`urlFilter\` fourni
- Crée une entrée \`site_crawls\` + \`crawl_jobs\`
- Déclenche le worker en fire-and-forget

### 2. Tarification

| Pages max | Crédits |
|-----------|---------|
| ≤ 50      | 5       |
| ≤ 100     | 10      |
| ≤ 200     | 15      |
| ≤ 500     | 30      |
| Pro Agency / Admin | 0 (illimité) |

### 3. Worker (\`process-crawl-queue\`)

- Récupère le prochain job \`pending\` ou \`processing\`
- Traite les URLs par **batch de 5** (concurrence contrôlée)
- Pour chaque URL : scrape via Firecrawl → extraction SEO → insert \`crawl_pages\`
- Met à jour le compteur \`processed_count\` en temps réel
- Statut final : \`completed\` ou \`error\`

### 4. Données extraites par page (\`crawl_pages\`)

| Donnée | Type | Description |
|--------|------|-------------|
| \`title\` | string | Balise \`<title>\` |
| \`meta_description\` | string | Meta description |
| \`h1\` | string | Premier H1 |
| \`h2_count\`, \`h3_count\` | number | Compteurs de headings |
| \`word_count\` | number | Nombre de mots |
| \`http_status\` | number | Code HTTP |
| \`internal_links\` | number | Liens internes |
| \`external_links\` | number | Liens externes |
| \`images_total\` | number | Total images |
| \`images_without_alt\` | number | Images sans alt |
| \`has_canonical\`, \`has_schema_org\`, \`has_og\` | boolean | Présence de balises |
| \`broken_links\` | JSON | Liste des liens cassés |
| \`seo_score\` | number | Score SEO calculé |
| \`response_time_ms\` | number | Temps de réponse |
| \`schema_org_types\` | JSON | Types schema.org détectés |

## Anti-détection (\`stealthFetch\`)

Le module \`_shared/stealthFetch.ts\` est utilisé par toutes les fonctions de scraping :

- **17+ User-Agents** réels (Chrome, Firefox, Safari, mobile)
- **Rotation des headers** : \`Sec-CH-UA\`, \`Accept-Language\`, \`Referer\`
- **Retries exponentiels** avec jitter aléatoire
- **Respect du Retry-After** pour les 429
- **Spoofing Referer** : simule un clic depuis Google/Bing

## Gestion des erreurs

| Erreur | Comportement |
|--------|-------------|
| 403 Forbidden | Retry avec nouveau User-Agent |
| 429 Rate Limit | Attente Retry-After + backoff |
| 500+ Server Error | Max 3 retries |
| Timeout | Skip la page, log l'erreur |
| Regex invalide | Rejet immédiat (400) |
| Crédits insuffisants | Rejet immédiat (402) |
`,
  },

  // ───────────────────────────────────────────────
  // SECTION 5 : VARIABLES D'ENVIRONNEMENT
  // ───────────────────────────────────────────────
  {
    id: 'env-vars',
    title: "Variables d'Environnement",
    icon: 'Key',
    content: `
# Variables d'Environnement

## Variables automatiques (Supabase)

Ces variables sont injectées automatiquement dans chaque Edge Function :

| Variable | Description |
|----------|-------------|
| \`SUPABASE_URL\` | URL du projet Supabase |
| \`SUPABASE_ANON_KEY\` | Clé publique (anon) |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Clé service (admin, côté serveur uniquement) |

## Variables Frontend (\`.env\`)

| Variable | Description |
|----------|-------------|
| \`VITE_SUPABASE_URL\` | URL publique Supabase |
| \`VITE_SUPABASE_PUBLISHABLE_KEY\` | Clé anon publique |
| \`VITE_SUPABASE_PROJECT_ID\` | ID du projet |

## Secrets Backend (Edge Functions)

Ces secrets doivent être configurés dans la console Lovable Cloud :

| Secret | Utilisé par | Description |
|--------|-------------|-------------|
| \`STRIPE_SECRET_KEY\` | \`create-checkout\`, \`stripe-webhook\`, billing | Clé secrète Stripe |
| \`STRIPE_WEBHOOK_SECRET\` | \`stripe-webhook\` | Secret de signature webhook |
| \`FIRECRAWL_API_KEY\` | \`crawl-site\`, \`process-crawl-queue\` | Clé API Firecrawl (scraping) |
| \`GOOGLE_PAGESPEED_API_KEY\` | \`check-pagespeed\` | Clé API Google PageSpeed Insights |
| \`GOOGLE_CSE_API_KEY\` | \`check-llm\` | Clé API Google Custom Search |
| \`GOOGLE_CSE_ID\` | \`check-llm\` | ID du moteur de recherche personnalisé |
| \`GOOGLE_CLIENT_ID\` | \`gsc-auth\` | OAuth Google Search Console |
| \`GOOGLE_CLIENT_SECRET\` | \`gsc-auth\` | OAuth Google Search Console |
| \`TURNSTILE_SECRET_KEY\` | \`verify-turnstile\` | Secret Cloudflare Turnstile |
| \`NEWS_API_KEY\` | \`fetch-news\` | Clé API pour actualités |

## Variables optionnelles

| Secret | Utilisé par | Description |
|--------|-------------|-------------|
| \`BROWSERLESS_API_KEY\` | Rendering SPA | Clé Browserless (rendu JS headless) |
| \`DATAFORSEO_LOGIN\` | \`measure-audit-impact\` | Login DataForSEO |
| \`DATAFORSEO_PASSWORD\` | \`measure-audit-impact\` | Password DataForSEO |

## Sécurité

- ⚠️ **Ne jamais** stocker de secrets dans le code source
- Les \`VITE_*\` sont publiques (exposées au navigateur) — seules les clés anon/publishable
- Les secrets Edge Functions sont injectés par Deno Deploy, jamais dans le bundle client
- Le \`SUPABASE_SERVICE_ROLE_KEY\` bypass toutes les RLS — usage serveur uniquement
`,
  },

  // ───────────────────────────────────────────────
  // SECTION 6 : MODULES PARTAGÉS
  // ───────────────────────────────────────────────
  {
    id: 'shared-modules',
    title: 'Modules Partagés',
    icon: 'Package',
    content: `
# Modules Partagés (_shared/)

Le dossier \`supabase/functions/_shared/\` contient les utilitaires réutilisés par toutes les Edge Functions.

## Liste des modules

### \`cors.ts\`
Headers CORS standard pour les réponses Edge Functions.

\`\`\`typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
\`\`\`

### \`stealthFetch.ts\`
Wrapper anti-détection pour les requêtes HTTP sortantes.

- Rotation de User-Agent (17+ agents)
- Headers réalistes (Sec-CH-UA, Accept-Language, Referer)
- Retries exponentiels avec jitter
- Respect des en-têtes Retry-After

### \`renderPage.ts\`
Moteur de rendu pour les pages SPA/JavaScript.

- Utilise Browserless (si disponible) pour le rendu headless
- Fallback sur fetch direct avec StealthFetch
- Extraction du HTML final après exécution JS

### \`auditCache.ts\`
Système de cache pour les résultats d'audit.

- Clé de cache basée sur : URL + fonction + paramètres
- TTL configurable par fonction
- Invalidation automatique à l'expiration

### \`tokenTracker.ts\`
Tracking des appels API externes payants.

- Log chaque appel dans \`api_call_logs\`
- Utilisé pour le monitoring des coûts
- Supporte : Firecrawl, Google PSI, DataForSEO, etc.

### \`ssrf.ts\`
Protection contre les attaques SSRF (Server-Side Request Forgery).

- Bloque les IPs privées (10.x, 172.16-31.x, 192.168.x, 127.x)
- Bloque les URLs \`localhost\`, \`0.0.0.0\`
- Valide le protocole (HTTP/HTTPS uniquement)

### \`trackUrl.ts\`
Utilitaire d'enregistrement des URLs analysées.

- Upsert dans \`analyzed_urls\`
- Incrémente le compteur d'analyses

### \`translations.ts\`
Traductions pour le contenu généré côté serveur (emails, rapports).
`,
  },

  // ───────────────────────────────────────────────
  // SECTION : SERP KPIs (DataForSEO)
  // ───────────────────────────────────────────────
  {
    id: 'serp-kpis',
    title: 'SERP KPIs (DataForSEO)',
    icon: 'BarChart3',
    content: `
# SERP KPIs — DataForSEO

## Vue d'ensemble

Les données SERP permettent de mesurer le positionnement Google d'un domaine : position moyenne, mots-clés classés, ETV (trafic estimé), distribution Top 3/10/50.

## Source de données

| Paramètre | Valeur |
|-----------|--------|
| **API** | DataForSEO Labs — \`ranked_keywords/live\` |
| **Localisation** | France (code 2250) |
| **Langue** | Français (\`fr\`) |
| **Limite** | 1 000 mots-clés (triés par rang ascendant) |
| **Secrets** | \`DATAFORSEO_LOGIN\`, \`DATAFORSEO_PASSWORD\` |

## Edge Functions

### \`fetch-serp-kpis\`
Fonction unitaire : prend un \`domain\` et retourne les KPIs SERP calculés.

**Payload d'entrée :**
\`\`\`json
{ "domain": "example.com", "url": "https://example.com" }
\`\`\`

**Payload de sortie :**
\`\`\`json
{
  "data": {
    "total_keywords": 142,
    "avg_position": 28.3,
    "homepage_position": 5,
    "top_3": 3,
    "top_10": 12,
    "top_50": 67,
    "etv": 1250,
    "sample_keywords": [
      { "keyword": "audit seo", "position": 3, "search_volume": 2400, "url": "..." }
    ],
    "measured_at": "2026-03-13T09:00:00Z"
  }
}
\`\`\`

### \`refresh-serp-all\`
CRON hebdomadaire (lundi 05:00 Paris) : itère sur tous les \`tracked_sites\` et appelle \`fetch-serp-kpis\` pour chacun, puis met à jour l'entrée la plus récente de \`user_stats_history\`.

## Stockage des données

Les données SERP **ne sont pas dans une table dédiée**. Elles sont stockées dans la colonne \`raw_data\` (JSONB) de la table **\`user_stats_history\`**, sous la clé \`serpData\` :

\`\`\`
user_stats_history
├── id (uuid)
├── user_id (uuid)
├── tracked_site_id (uuid)
├── domain (text)
├── raw_data (jsonb)
│   ├── serpData ← 🎯 données SERP DataForSEO
│   │   ├── total_keywords
│   │   ├── avg_position
│   │   ├── homepage_position
│   │   ├── top_3 / top_10 / top_50
│   │   ├── etv
│   │   ├── sample_keywords[]
│   │   └── measured_at
│   ├── performanceScore
│   ├── llmOverallScore
│   └── ...autres KPIs
└── recorded_at (timestamptz)
\`\`\`

## Déclencheurs de synchronisation

| Déclencheur | Mécanisme |
|-------------|-----------|
| **Après audit technique** | Fire-and-forget via \`syncSerpToTrackedSite()\` dans \`ExpertAuditDashboard\` |
| **Après audit stratégique** | Idem — même fonction appelée à la fin du flux stratégique |
| **Rafraîchissement manuel** | Bouton 🔄 dans le bandeau SERP de 'Mes sites' (\`SerpKpiBanner\`) |
| **CRON hebdomadaire** | \`refresh-serp-all\` tous les lundis à 05:00 (UTC+1) |

## Affichage côté client

Le composant \`SerpKpiBanner\` (dans \`src/components/Profile/SerpKpiBanner.tsx\`) affiche :
- Position moyenne
- Rang homepage
- Total mots-clés (Top 100)
- ETV (trafic mensuel estimé)

Les données sont lues depuis la dernière entrée \`user_stats_history\` du site sélectionné.
`,
  },

  // ───────────────────────────────────────────────
  // SECTION : COCOON — ARCHITECTURE SÉMANTIQUE
  // ───────────────────────────────────────────────
  {
    id: 'cocoon',
    title: 'Cocoon — Architecture Sémantique',
    icon: 'Network',
    content: `
# Cocoon — Architecture Sémantique Vivante

## Vue d'ensemble

Le module Cocoon transforme les données de crawl d'un site en une **visualisation organique** du maillage sémantique. Chaque page est un nœud pulsant, chaque lien une connexion neuronale. Réservé aux abonnés **Pro Agency** et aux admins.

## Table \`semantic_nodes\`

| Colonne | Type | Description |
|---------|------|-------------|
| \`id\` | uuid | Identifiant unique du nœud |
| \`tracked_site_id\` | uuid (FK) | Référence vers \`tracked_sites\` |
| \`user_id\` | uuid | Propriétaire du nœud |
| \`url\` | text | URL de la page |
| \`title\` | text | Titre SEO de la page |
| \`cluster_id\` | text | Identifiant du cluster sémantique |
| \`cluster_label\` | text | Label lisible du cluster |
| \`depth\` | int | Profondeur dans l'arborescence du site |
| \`internal_links_in\` | int | Nombre de liens entrants internes |
| \`internal_links_out\` | int | Nombre de liens sortants internes |
| \`word_count\` | int | Nombre de mots de la page |
| \`traffic_estimate\` | float | Estimation du trafic mensuel |
| \`cpc_estimate\` | float | CPC moyen estimé |
| \`keyword_volume\` | int | Volume de recherche du mot-clé principal |
| \`iab_score\` | float | Score Anti-Wiki (0-100) — difficulté SERP |
| \`geo_score\` | float | Score GEO (0-100) — optimisation IA |
| \`roi_predictive\` | float | ROI annualisé prédictif (€) |
| \`citability_score\` | float | Score de citabilité LLM (0-1) |
| \`embedding_vector\` | jsonb | Vecteur d'embedding 64 dimensions |
| \`similarity_edges\` | jsonb | Top 10 nœuds les plus proches |
| \`x\` / \`y\` | float | Coordonnées de positionnement du graphe |

## Edge Function : \`calculate-cocoon-logic\`

### Flux de calcul

1. **Authentification** : Vérifie JWT + plan agency_pro/agency_premium ou admin
2. **Récupération des données** : Charge les pages du dernier crawl (\`crawl_pages\`) et les données SERP (\`user_stats_history\`)
3. **Génération d'embeddings** : Via Lovable AI (Gemini Flash), batch de 5
4. **Calcul de similarité** : Cosinus entre tous les paires de vecteurs
5. **Clustering** : Algorithme greedy par seuils de similarité (fort > 0.75, moyen > 0.55)
6. **Score Iab** : Classification des concurrents SERP (Wiki, Gov, Social, News) → score de difficulté
7. **ROI prédictif** : \`traffic_estimate × cpc_estimate × conversion_rate × 12\`
8. **Upsert** : Les nœuds sont insérés/mis à jour dans \`semantic_nodes\`

### Algorithme Anti-Wiki (Iab)

Le score Iab (0-100) mesure la difficulté de ranking face aux sites d'autorité :
- **Wikipedia / .gov / .edu** : +30 points de difficulté
- **Réseaux sociaux** (youtube, twitter, linkedin) : +15 points
- **Sites d'actualité** : +10 points
- Score final = \`100 - difficulté_totale\` (clampé 0-100)

### Circuit Breaker

Les appels d'embedding utilisent un circuit breaker (5 échecs max) avec retry exponentiel pour éviter les cascades de timeout.

## Frontend

### Route : \`/cocoon\`

- **Rendu Canvas D3.js** via \`CocoonForceGraph.tsx\` — supporte 500+ nœuds interactifs
- **CocoonNodePanel.tsx** : Panneau latéral détaillé avec métriques Iab, GEO, ROI et liens de proximité
- **Mode X-Ray** : Toggle pour révéler les nœuds fantômes (faible trafic)
- **Gate d'accès** : Vérification \`agency_pro\` / \`agency_premium\` / admin

### Route : \`/features/cocoon\`

Landing page marketing avec comparaison GEO vs SEO et grille de fonctionnalités.

## RLS Policies

- \`SELECT\` : \`user_id = auth.uid() OR has_role(auth.uid(), 'admin')\`
- \`INSERT / UPDATE / DELETE\` : \`user_id = auth.uid()\`
`,
  },
];

/**
 * Métadonnées de la documentation.
 * Modifiez la version et la date à chaque mise à jour significative.
 */
export const docMetadata = {
  version: '1.4.0',
  lastUpdated: '2026-03-15',
  projectName: 'Crawlers — Plateforme Audit SEO/GEO/LLM + Architecte Génératif + Cocoon',
  totalEdgeFunctions: 82,
  totalTables: '38+',
  totalLinesOfCode: '125 000+',
};
