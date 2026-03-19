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
│  94 fonctions serverless + 21 modules partagés        │
│  - Audit engines (SEO, GEO, LLM, PageSpeed)             │
│  - Crawl engine (Firecrawl + processing queue)           │
│  - AI pipelines (Gemini, GPT via Lovable AI)             │
│  - Stripe billing, Auth, Analytics                       │
└────────────────────────┬────────────────────────────────┘
                         │ PostgREST / SQL
┌────────────────────────▼────────────────────────────────┐
│              SUPABASE POSTGRESQL                        │
│  50+ tables avec RLS, fonctions PL/pgSQL, triggers    │
│  Schémas : public (app), auth (Supabase), storage       │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Stack Technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Frontend | React 18 + Vite + TypeScript | SPA avec SSR-like SEO (Helmet) |
| UI | Tailwind CSS + shadcn/ui + Framer Motion | Design system avec tokens sémantiques |
| State | React Query + Context API | Cache serveur + état global auth/crédits |
| Backend | Supabase Edge Functions (Deno) | 94 fonctions serverless + 21 modules partagés |
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

### Google My Business (GMB)

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`gmb_locations\` | Liaison tracked_site ↔ fiche GMB | \`tracked_site_id\`, \`location_name\`, \`place_id\`, \`address\`, \`phone\`, \`hours\` (JSON) |
| \`gmb_reviews\` | Avis Google récupérés | \`gmb_location_id\`, \`google_review_id\`, \`star_rating\`, \`comment\`, \`reply_comment\`, \`is_flagged\` |
| \`gmb_posts\` | Publications GMB | \`gmb_location_id\`, \`post_type\` (STANDARD/EVENT/OFFER), \`summary\`, \`status\`, \`published_at\` |
| \`gmb_performance\` | Stats hebdomadaires | \`gmb_location_id\`, \`week_start_date\`, \`search_views\`, \`maps_views\`, \`website_clicks\`, \`phone_calls\`, \`avg_rating\` |

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
| \`audit-compare\` | ✅ | 4 | Analyse concurrentielle face-à-face |
| \`audit-local-seo\` | ✅ | 1 | Audit SEO local |
| \`diagnose-hallucination\` | ✅ | 1 | Diagnostic d'hallucination LLM |
| \`check-llm-depth\` | ✅ | 0 | Profondeur de visibilité LLM multi-itération |

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
| \`cocoon-chat\` | ✅ | 0 | Assistant IA conversationnel Cocoon (Gemini, streaming SSE) |
| \`extract-pdf-data\` | ✅ | 0 | Extraction de données depuis PDF |

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
| \`apply-affiliate\` | ✅ | Applique un code affilié |
| \`apply-retention-offer\` | ✅ | Applique une offre de rétention |
| \`manage-team\` | ✅ | Gestion équipe agence |
| \`check-email-exists\` | ✅ | Vérifie l'existence d'un email |
| \`send-password-reset\` | ✅ | Envoie un lien de réinitialisation |
| \`send-verification-code\` | ✅ | Envoie un code de vérification email |
| \`verify-email-code\` | ✅ | Vérifie un code email |
| \`admin-update-plan\` | ✅ | MAJ plan utilisateur (admin) |

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
| \`agent-cto\` | ✅ | Agent CTO autonome (auto-optimisation prompts) |
| \`agent-seo\` | ✅ | Agent SEO autonome |
| \`aggregate-observatory\` | ✅ | Agrégation observatoire sectoriel |
| \`calculate-llm-volumes\` | ✅ | Calcul volumes LLM |
| \`calculate-llm-visibility\` | ✅ | Calcul score visibilité LLM |
| \`calculate-ias\` | ✅ | Calcul Indice d'Alignement Stratégique |
| \`calculate-internal-pagerank\` | ✅ | PageRank interne par page |
| \`measure-audit-impact\` | ✅ | Mesure d'impact post-audit |
| \`snapshot-audit-impact\` | ✅ | Snapshot T+30/60/90 |
| \`auto-measure-predictions\` | ✅ | Mesure automatique des prédictions |
| \`update-market-trends\` | ✅ | MAJ tendances marché |
| \`refresh-llm-visibility-all\` | ✅ | CRON rafraîchissement visibilité LLM |
| \`persist-cocoon-session\` | ✅ | Sauvegarde session Cocoon |
| \`fetch-ga4-data\` | ✅ | Récupère données Google Analytics 4 |
| \`fetch-sitemap-tree\` | ✅ | Arborescence du sitemap XML |
| \`sdk-status\` | ❌ | Statut du SDK widget |
| \`sitemap\` | ❌ | Génération sitemap XML |
| \`rss-feed\` | ❌ | Flux RSS du blog |
| \`verify-turnstile\` | ❌ | Vérification Cloudflare Turnstile |
| \`widget-connect\` | ❌ | Connexion du widget externe |
| \`serve-client-script\` | ❌ | Sert le script client GTM |
| \`wpsync\` | ✅ | Synchronisation WordPress |
| \`auth-email-hook\` | ❌ | Hook personnalisé emails auth |
| \`process-email-queue\` | ✅ | Worker file d'attente emails |
| \`process-script-queue\` | ✅ | Worker file d'attente scripts |
| \`dry-run-script\` | ✅ | Test à blanc d'un script correctif |
| \`archive-solution\` | ✅ | Archive une solution/correctif |
| \`watchdog-scripts\` | ✅ | Watchdog CRON des scripts déployés |
| \`kill-all-viewers\` | ✅ | Révoque tous les viewers (admin) |
| \`view-function-source\` | ✅ | Consultation source d'une edge function |
| \`run-backend-tests\` | ✅ | Exécute les tests backend |
| \`update-config\` | ✅ | MAJ configuration système |

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

**Internationalisation** : Module intégralement traduit en **FR / EN / ES** (page, panneaux, légende dynamique, prompts IA, gate d'accès).

## Table \\\`semantic_nodes\\\`

| Colonne | Type | Description |
|---------|------|-------------|
| \\\`id\\\` | uuid | Identifiant unique du nœud |
| \\\`tracked_site_id\\\` | uuid (FK) | Référence vers \\\`tracked_sites\\\` |
| \\\`user_id\\\` | uuid | Propriétaire du nœud |
| \\\`url\\\` | text | URL de la page |
| \\\`title\\\` | text | Titre SEO de la page |
| \\\`h1\\\` | text | Contenu du H1 |
| \\\`keywords\\\` | jsonb | Mots-clés extraits (top 10 TF) |
| \\\`cluster_id\\\` | text | Identifiant du cluster (composantes connexes) |
| \\\`depth\\\` | int | Profondeur : 0 = seed cluster, 1 = membre |
| \\\`page_type\\\` | text | Type détecté : homepage, blog, produit, catégorie, faq, guide, contact, tarifs, légal, à propos, page |
| \\\`intent\\\` | text | Intent classifié : transactional, commercial, informational, navigational |
| \\\`internal_links_in\\\` | int | Nombre de liens entrants internes |
| \\\`internal_links_out\\\` | int | Nombre de liens sortants internes |
| \\\`word_count\\\` | int | Nombre de mots de la page |
| \\\`crawl_depth\\\` | int | Profondeur de crawl (0 = homepage) |
| \\\`traffic_estimate\\\` | float | Estimation du trafic mensuel |
| \\\`cpc_value\\\` | float | CPC moyen (enrichi depuis audit) |
| \\\`search_volume\\\` | int | Volume de recherche (enrichi depuis audit) |
| \\\`keyword_difficulty\\\` | float | Difficulté du mot-clé (enrichi depuis audit) |
| \\\`iab_score\\\` | float | Score Anti-Wiki (0-100) — difficulté SERP |
| \\\`eeat_score\\\` | float | Score E-E-A-T (repris du seo_score crawl) |
| \\\`roi_predictive\\\` | float | ROI annualisé prédictif (€) |
| \\\`similarity_edges\\\` | jsonb | Top 10 nœuds les plus proches (cosinus TF-IDF) |
| \\\`status\\\` | text | \\\`pending\\\` → \\\`computed\\\` |

## Edge Function : \\\`calculate-cocoon-logic\\\`

### Algorithme (100% déterministe, aucun LLM)

1. **Authentification** : Vérifie JWT + plan agency_pro/agency_premium ou admin
2. **Vérification propriété** : Le site tracké doit appartenir à l'utilisateur
3. **Récupération des données** : Charge les pages du dernier crawl (\\\`crawl_pages\\\`), limité à **100 pages max** triées par profondeur
4. **Filtrage** : Exclut les pages HTTP ≥ 400 (403, 500, etc.)
5. **Enrichissement** : Croise avec les données d'audit existantes (\\\`audits\\\`) pour CPC, volume, KD, compétiteurs SERP
6. **Extraction de mots-clés** : TF-based (top 10 termes par fréquence, hors stopwords FR/EN)
7. **Classification intent** : Basée sur des listes de mots-clés transactionnels, navigationnels, commerciaux
8. **Classification type de page** : Basée sur le path URL + titre/H1

### Vectorisation TF-IDF

\\\`\\\`\\\`
Pour chaque page :
  texte = titre + h1 + meta_description + keywords
  tokens = tokenize(texte)  // ≥3 chars, sans stopwords FR/EN
  TF = log(1 + count)
  IDF = log(N / df)
  vecteur = TF × IDF (sparse map)
\\\`\\\`\\\`

### Similarité cosinus (sparse)

Calcul O(n²) entre toutes les paires de vecteurs TF-IDF :

| Seuil | Type | Usage |
|-------|------|-------|
| ≥ 0.4 | **strong** | Lien sémantique fort |
| ≥ 0.2 | **medium** | Lien modéré — utilisé pour le clustering |
| ≥ 0.1 | **weak** | Lien faible — affiché mais pas dans les clusters |

Chaque nœud conserve ses **10 meilleurs edges** triés par score.

### Clustering (Composantes connexes)

Les nœuds sont groupés via BFS sur les edges **medium+** (≥ 0.2). Chaque composante connexe = un cluster (\\\`cluster_0\\\`, \\\`cluster_1\\\`, etc.). Les nœuds isolés reçoivent un \\\`cluster_singleton_N\\\`.

### Score Anti-Wiki (Iab)

Le score Iab (0-100) mesure la difficulté de ranking face aux sites d'autorité :
- **Wiki / Encyclopédies** (wikipedia, larousse, britannica…) : augmente la difficulté
- **Gouvernement / .edu** (.gouv.fr, .gov, .edu) : augmente la difficulté
- **Réseaux sociaux** (youtube, reddit, quora, linkedin…) : difficulté modérée
- Formule : \\\`baseScore = (1 - authorityRatio) × 70 + (1 - socialRatio) × 30\\\`

### ROI Prédictif

\\\`\\\`\\\`
estimatedCTR = max(0.01, (100 - KD) / 100 × 0.15)
traffic = volume × CTR
convRate = convPotential / 100 × 0.03
ROI = traffic × CPC × convRate × 12  // annualisé
\\\`\\\`\\\`

### Estimation trafic

- Si position SERP connue (1-10) : lookup table CTR (pos 1 = 28%, pos 10 = 2%)
- Sinon : \\\`volume × max(0.01, (100 - KD) / 100 × 0.10)\\\`

### Rate limiting & sécurité

- IP rate limit : 5 appels / 60s
- Erreurs loguées via \\\`silentErrorLogger\\\` + \\\`tokenTracker\\\`
- Insert par batch de 50 nœuds

## Frontend

### Route : \\\`/cocoon\\\`

- **Rendu Canvas D3.js** via \\\`CocoonForceGraph.tsx\\\` — supporte 500+ nœuds interactifs
- **CocoonNodePanel.tsx** : Panneau latéral détaillé avec métriques Iab, GEO, ROI, maillage, mots-clés et liens de proximité sémantique — **entièrement i18n FR/EN/ES**
- **Mode X-Ray** : Toggle pour révéler les nœuds fantômes (faible trafic)
- **Légende dynamique** : N'affiche que les types de pages réellement présents dans le cocon, avec animation fade-in retardée (1.2s)
- **Gate d'accès** : Vérification \\\`agency_pro\\\` / \\\`agency_premium\\\` / admin — i18n FR/EN/ES
- **Assistant IA** (\\\`CocoonAIChat\\\`) : Chat Gemini 3 Flash avec accès complet aux données du domaine (crawl, audit, SERP, backlinks, GSC, GA4), sélection multi-nœuds (max 3), analyse comparative, streaming SSE, réponses limitées à 1000 caractères — i18n FR/EN/ES
- **Bannière de troncature** : Affichée si le site dépasse 100 pages (dorée)
- **Auto-refresh** : Détecte le retour de l'utilisateur après un audit/crawl dans un nouvel onglet et régénère automatiquement le cocon (via \\\`visibilitychange\\\` + vérification DB des nouveaux rapports)
- **Navigation rapide** : Boutons vers Audit Expert, Crawl Multi-pages (nouveaux onglets) et Console (retour)

### Route : \\\`/features/cocoon\\\`

Landing page marketing avec comparaison GEO vs SEO et grille de fonctionnalités.

## RLS Policies

- \\\`SELECT\\\` : \\\`user_id = auth.uid() OR has_role(auth.uid(), 'admin')\\\`
- \\\`INSERT / UPDATE / DELETE\\\` : \\\`user_id = auth.uid()\\\`
`,
  },
  // ───────────────────────────────────────────────
  // SECTION : INDICATEURS SEO / GEO / SERP / EEAT
  // ───────────────────────────────────────────────
  {
    id: 'indicators',
    title: 'Indicateurs SEO / GEO / SERP / EEAT',
    icon: 'Package',
    content: `
# Indicateurs SEO / GEO / SERP / EEAT

Référentiel de tous les indicateurs calculés par la plateforme, avec leur source et leur mode de construction.

---

## Indicateurs SEO (Audit Technique)

| Indicateur | Construction |
|------------|-------------|
| **Score SEO** | Moyenne pondérée de 6 sous-scores : performance mobile, structure HTML (Hn, meta), sécurité (HTTPS, Safe Browsing), accessibilité bots, densité contenu et maillage. |
| **Perf. Mobile** | Score PageSpeed Insights (API Google) mesurant LCP, FCP, CLS, TTFB et TBT sur émulation mobile Moto G Power. |
| **Perf. Desktop** | Même calcul que Perf. Mobile mais sur émulation desktop via l'API PageSpeed Insights. |
| **LCP (Largest Contentful Paint)** | Temps de rendu du plus grand élément visible (image ou bloc texte), mesuré en millisecondes par PageSpeed Insights. |
| **FCP (First Contentful Paint)** | Temps avant l'affichage du premier texte ou image, mesuré en millisecondes par PageSpeed Insights. |
| **CLS (Cumulative Layout Shift)** | Somme des décalages visuels inattendus pendant le chargement, score sans unité (0 = stable). |
| **TTFB (Time To First Byte)** | Temps de réponse du serveur au premier octet, mesuré en millisecondes par PageSpeed Insights. |
| **Ratio texte/HTML** | Pourcentage de contenu textuel visible par rapport au code HTML total, calculé après suppression des balises script/style/template. Exclu du score si la page est une homepage. |
| **Volume de contenu** | Nombre de mots de texte visible extraits du DOM après nettoyage (seuil : 500 mots minimum). |
| **Profil de liens** | Comptage des liens internes et externes détectés dans le DOM de la page analysée. |
| **Images sans alt** | Nombre d'images dont l'attribut 'alt' est absent ou vide, détecté par parsing HTML avec regex multi-format. |
| **Poids de page** | Taille totale des ressources chargées (HTML + CSS + JS + images), récupérée via PageSpeed Insights. |
| **Détection SPA** | Compare le volume de texte entre le HTML brut et le rendu Browserless pour identifier les Single Page Applications. |

---

## Indicateurs GEO (Generative Engine Optimization)

| Indicateur | Construction |
|------------|-------------|
| **Score GEO** | Score composite (0-100%) évaluant la compatibilité du site avec les moteurs de recherche génératifs (SGE, ChatGPT, Perplexity). |
| **Robots.txt** | Vérifie l'existence et le contenu du fichier robots.txt : permissivité générale et autorisation spécifique des bots IA (GPTBot, Google-Extended, ClaudeBot, etc.). |
| **Bots IA autorisés** | Nombre de crawlers IA explicitement autorisés dans le robots.txt, sur un total de 6 bots principaux vérifiés. |
| **JSON-LD** | Détection et validation syntaxique des blocs JSON-LD dans le code source statique de la page (les JSON-LD injectés par JavaScript sont pénalisés de -3 pts). |
| **Schema.org** | Présence de données structurées Schema.org (JSON-LD, Microdata ou RDFa) dans le HTML de la page. |
| **Cohérence Title/H1** | Similarité textuelle entre la balise Title et le H1 principal, calculée par comparaison de tokens (seuil : 30% minimum). |
| **llms.txt** | Détection de la présence d'un fichier 'llms.txt' à la racine du domaine, standard émergent pour guider les LLM. |
| **Citabilité LLM** | Score estimant la probabilité qu'un LLM cite cette page dans ses réponses, basé sur la structure du contenu (listes, FAQ, tableaux), la densité informationnelle et la présence de données structurées. |
| **Content Gap** | Écart entre le contenu existant et le contenu attendu par les LLM sur le sujet, évalué par analyse comparative SERP + IA. |

---

## Indicateurs SERP & Concurrence

| Indicateur | Construction |
|------------|-------------|
| **Position SERP** | Position organique du domaine sur le mot-clé cible, récupérée via l'API DataForSEO (Google FR). |
| **Volume de recherche** | Volume mensuel moyen de recherches pour le mot-clé, fourni par DataForSEO (données Google Keyword Planner). |
| **Keyword Difficulty (KD)** | Indice de difficulté (0-100) pour se positionner sur le mot-clé, calculé par DataForSEO à partir de l'autorité des pages en top 10. |
| **CPC** | Coût par clic moyen en EUR du mot-clé dans Google Ads, fourni par DataForSEO. |
| **Part de voix (SOV)** | Pourcentage de visibilité SERP du domaine sur l'ensemble des requêtes cibles suivies, calculé par 'calculate-sov'. |
| **Competitors SERP** | Liste des 10 premiers domaines positionnés sur le mot-clé cible avec leur autorité respective, via DataForSEO. |
| **ROI Prédictif** | Estimation annualisée du revenu potentiel : trafic_estimé × CPC × taux_conversion × 12. |
| **Estimation trafic** | Si position connue : lookup table CTR (pos 1 = 28%…pos 10 = 2%). Sinon : volume × CTR_estimé. |

---

## Indicateurs E-E-A-T (Thought Leadership)

| Indicateur | Construction |
|------------|-------------|
| **Score E-E-A-T** | Score global (0-10) évaluant l'Expérience, l'Expertise, l'Autorité et la Fiabilité du site, calculé par analyse IA des signaux SERP en temps réel. |
| **Signaux sociaux** | Détection de la présence officielle de la marque sur les réseaux sociaux (Facebook, LinkedIn, Twitter/X) via recherche SERP croisée marque + secteur. |
| **Autorité sémantique** | Mesure de la force du domaine comme source de référence sur son sujet, basée sur le ratio de domaines gouvernementaux, éducatifs et médias dans les résultats SERP concurrents. |
| **Sentiment IA** | Perception de la marque par les LLM (très positif / positif / neutre / négatif), évaluée en interrogeant directement les modèles IA sur la réputation du domaine. |

---

## Indicateurs LLM (Benchmark)

| Indicateur | Construction |
|------------|-------------|
| **Visibilité IA** | Score (0-100) mesurant si le domaine est mentionné par les LLM en réponse à des requêtes sectorielles, testé sur ChatGPT, Gemini et Perplexity. |
| **Benchmark LLM** | Scores de visibilité par modèle IA (ChatGPT, Gemini, Perplexity), mesurés via 3 itérations conversationnelles pondérées (100/50/25 pts). |
| **Taux de citation LLM** | Pourcentage de requêtes pour lesquelles le domaine est explicitement cité dans la réponse du LLM. |
| **Volumes LLM estimés** | Estimation du trafic potentiel provenant de chaque LLM, calculée via la table 'market_trends' (parts de marché FR) × taux de pénétration par type d'intention (informationnelle, commerciale, locale). |
| **LLM Depth** | Test approfondi en 3 itérations conversationnelles avec relances (alternatives, niches), vérifiant si la marque apparaît naturellement dans les réponses des LLM gratuits. |

---

## Indicateurs IAS (Indice d'Alignement Stratégique)

| Indicateur | Construction |
|------------|-------------|
| **Score IAS** | Ratio entre le trafic organique générique et le trafic total (brand + générique), comparé au ratio cible du secteur d'activité. |
| **Risk Score** | Écart entre le ratio réel et le ratio cible : un score élevé signale une sur-dépendance au trafic de marque. |
| **Brand Penetration Rate** | Part du trafic de marque dans le trafic organique total, calculée via les données GSC (clicks brand vs generic). |

---

## Indicateurs Cocoon (Architecture Sémantique)

| Indicateur | Construction |
|------------|-------------|
| **Cannibalization Risk** | Probabilité que deux pages du même site se disputent le même mot-clé, détectée par similarité TF-IDF entre les nœuds du graphe. |
| **GEO Score (nœud)** | Score GEO individuel par page, hérité de l'audit expert ou estimé par le moteur Cocoon. |
| **Internal Links In/Out** | Nombre de liens internes entrants et sortants par page, extraits du crawl multi-pages. |
| **Cluster ID** | Regroupement thématique automatique des pages par similarité sémantique (TF-IDF + analyse IA). |
| **Page Authority** | Score d'autorité interne calculé par l'algorithme PageRank adapté au maillage interne du site. |

---

## Indicateurs GMB (Google My Business)

| Indicateur | Construction |
|------------|-------------|
| **Search Views** | Nombre de fois où la fiche apparaît dans les résultats de recherche Google (Business Profile Performance API). |
| **Maps Views** | Nombre de fois où la fiche apparaît dans Google Maps. |
| **Website Clicks** | Nombre de clics vers le site web depuis la fiche GMB. |
| **Direction Requests** | Nombre de demandes d'itinéraire vers l'établissement. |
| **Phone Calls** | Nombre d'appels téléphoniques initiés depuis la fiche. |
| **Avg Rating** | Note moyenne des avis Google (1-5 étoiles). |
| **Review Volume** | Nombre total d'avis et tendance (nouveaux avis / semaine). |
| **Photo Views** | Nombre de vues des photos publiées sur la fiche. |

---

## Indicateurs Surveys (Enquêtes Utilisateurs)

| Indicateur | Construction |
|------------|-------------|
| **Impressions** | Nombre total d'affichages de la survey aux utilisateurs ciblés (table survey_events, event_type='impression'). |
| **Taux de réponse** | Ratio réponses / impressions. |
| **Taux de fermeture** | Ratio fermetures (dismiss) / impressions. |
| **Réponses A/B** | Ventilation des réponses par variante (A ou B) pour les surveys avec A/B testing activé. |
| **Ciblage persona** | Filtrage par langue, type de client (entrepreneur, agence, freelance, boutique), et ancienneté du compte. |
`,
  },
];

/**
 * Métadonnées de la documentation.
 * Modifiez la version et la date à chaque mise à jour significative.
 */
export const docMetadata = {
  version: '2.8.0',
  lastUpdated: '2026-03-19',
  projectName: 'Crawlers — Plateforme Audit SEO/GEO/LLM + Architecte Génératif + Cocoon + GMB + Surveys',
  totalEdgeFunctions: 94,
  totalSharedModules: 21,
  totalTables: '50+',
  totalLinesOfCode: '147 600+',
  totalMigrations: 160,
  totalPages: 36,
  totalComponents: 261,
};
