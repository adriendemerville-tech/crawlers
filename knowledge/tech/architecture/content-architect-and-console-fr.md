# Content Architect, /Console & Onglet Concurrence — Architecture Backend & Frontend

> **Documentation technique exhaustive de trois zones produit majeures de Crawlers.**
> Édition : Avril 2026.

---

## 1. Vue d'ensemble

Trois zones produit interconnectées partagent un socle commun (audit cache, fair use, async jobs, RLS multi-tenant) :

| Zone | Surface utilisateur | Backend principal |
|---|---|---|
| **Content Architect** | Modal Canva-like dans `/app/cocoon` + landing `/content-architect` | `content-architecture-advisor`, `cms-publish-draft`, `cms-patch-content` |
| **/Console** | `/app/console` (5 onglets : Indexation, GEO, Content, SERP, SEA→SEO, BigQuery) | `check-indexation`, `serp-benchmark`, `sea-seo-bridge`, `gsc-bigquery-query` |
| **Mes Sites > Concurrence** | Onglet "Concurrence" dans `MesSites` | `audit-competitor-url` |

---

## 2. Content Architect

### 2.1 Frontend — Composants clés

| Composant | Rôle |
|---|---|
| `CocoonContentArchitectModal.tsx` | **Cœur de l'éditeur Canva-like** — toolbar 8 panneaux, preview live, gestion drafts |
| `ContentArchitectContext.tsx` | Context React partagé : draft courant, voice DNA, mode (create/edit), site cible |
| `ContentArchitect.tsx` (page `/content-architect`) | Landing marketing — pas de logique métier réelle |
| `panels/StructurePanel.tsx` | Configuration H1/H2/H3, méta, schema.org |
| `panels/ImagePanel.tsx` | Génération + bibliothèque centralisée |
| `panels/DraftPanel.tsx` | Édition contenu, prévisualisation |
| `panels/SeoPanel.tsx` | Analyse mots-clés, density, lisibilité |
| `panels/GeoPanel.tsx` | Score chunkability, quotability, structure GEO |
| `panels/EeatPanel.tsx` | Signaux E-E-A-T (auteur, sources, témoignages) |
| `panels/PublishPanel.tsx` | Sélection plateforme CMS, scheduling, statut |
| `panels/HistoryPanel.tsx` | Versions précédentes, rollback |

**Workflow utilisateur typique** :
1. Ouverture du modal depuis `/app/cocoon` → click sur un node "à créer/améliorer"
2. Pré-call `cocoon-strategist` → suggestions de brief (tonalité, angle, CTA, liens internes)
3. Pré-call `extract-architect-fields` → extraction page_type, persona, intent
4. Génération via `content-architecture-advisor` (pipeline 4 étapes)
5. Édition manuelle dans les panneaux
6. Publication via `cms-publish-draft` (création) ou `cms-patch-content` (modification)

### 2.2 Backend — Edge Functions

#### `content-architecture-advisor`

**Deux modes** :

**Legacy** (déprécié, fallback) : appel direct LLM avec prompt monolithique → JSON de recommandations.

**Pipeline éditoriale 4 étapes** (default depuis Sprint 9) :

```
ContentBrief (déterministe pré-LLM)
    ↓
[1. BRIEFING]    Briefer LLM (gemini-2.5-flash) → structure pages, angle, mots-clés
    ↓
[2. STRATÈGE]    Strategist LLM (gemini-2.5-pro) → architecture H1/H2/H3, schema, CTA
    ↓
[3. RÉDACTEUR]   Writer LLM (gpt-5) → corps du texte, exemples, citations
    ↓
[4. TONALISATEUR] Tonalizer LLM (gemini-2.5-flash) → adaptation voice DNA, ton final
```

**Routage modèle** par domaine × type :
- B2B technique → `gpt-5` pour rédacteur (précision)
- E-commerce → `gemini-2.5-flash` (rapidité, volume)
- SaaS → `gemini-2.5-pro` (raisonnement)

**Outputs persistés** : `content_drafts` (brouillon complet) + `architect_workbench` (recos atomiques).

#### `cms-publish-draft`

Crée un **nouveau** contenu sur 7 plateformes CMS :

| Plateforme | Méthode | Auth |
|---|---|---|
| **WordPress** | REST API `/wp-json/wp/v2/posts` ou `/pages` | Application Password |
| **Shopify** | Admin API GraphQL (articles, pages, blog posts) | Admin token |
| **Wix** | Wix Data API + Velo | OAuth2 |
| **Webflow** | Collections API v2 | API Token |
| **Drupal** | JSON:API `/jsonapi/node/article` | Basic Auth + CSRF |
| **Odoo** | XML-RPC `website.page` | API key |
| **PrestaShop** | Webservice REST | API key |
| **Crawlers interne** | INSERT direct `blog_articles` ou `seo_page_drafts` | Service role |

**Construction HTML** :
- Assemblage from-scratch : H1 + sections H2/H3 + paragraphes + images + schema JSON-LD
- Injection meta (title, description, canonical, OG)
- Sanitization via DOMPurify côté serveur

#### `cms-patch-content`

Modifie un contenu **existant**. Récupère le HTML actuel, applique des opérations atomiques :
- `replace` : remplacement de selector CSS (h1, meta[name=description], etc.)
- `append` : ajout de bloc en fin de section
- `prepend` : ajout en début
- `insert_before` / `insert_after` : insertion ciblée

Utilise le sélecteur `target_selector` de chaque entrée `architect_workbench`.

#### `generate-image`

Routeur multi-modèles avec NO_TEXT_GUARD :
- `imagen-3` (Google) — défaut, bon ratio qualité/prix
- `flux-1.1-pro` (Black Forest Labs) — créatif
- `ideogram-v2` — typographie (uniquement si texte explicitement demandé)

Stockage centralisé dans bucket Supabase `image-library`, partagé avec Social Content Hub.

### 2.3 Workflow complet

```
[User clique "Créer contenu" sur node Cocoon]
    ↓
[CocoonContentArchitectModal s'ouvre avec node context]
    ↓
[cocoon-strategist] → suggestions brief
    ↓
[extract-architect-fields] → page_type, persona, intent
    ↓
[content-architecture-advisor pipeline 4 étapes]
    ↓
[Render dans 8 panneaux, édition utilisateur]
    ↓
[generate-image] (optionnel) → images dans image-library
    ↓
[cms-publish-draft] → publication CMS
    ↓
[architect_workbench.status = 'deployed']
    ↓
[counter-audit cron 24h] → validation post-déploiement
```

---

## 3. /Console — 5 Onglets

### 3.1 Onglet Indexation (`IndexationMonitor.tsx`)

**Edge function** : `check-indexation`

- Appelle **GSC URL Inspection API** (1 URL/sec, quota 2000/jour partagé)
- Statuts : `INDEXED`, `NOT_INDEXED`, `CRAWLED_NOT_INDEXED`, `DISCOVERED_NOT_INDEXED`, `URL_IS_UNKNOWN_TO_GOOGLE`
- Persiste dans `indexation_history` (séries temporelles)
- UI : graphe d'évolution + table par URL + filtres status/date

**Gestion quotas** :
- Fair use : 50 checks/jour (free), 500 (Pro Agency), 5000 (Pro Agency+)
- Cache 24h sur même URL pour éviter re-check inutile

### 3.2 Onglet GEO (`GeoConsoleTab.tsx`)

Bandeau **7 KPIs** + **4 cartes** (cf. `features/console/geo-kpis-sprint1`) :
- KPIs : Bot Hits, Quotability Score, Fan-out Detection Rate, GEO Visibility, Bot↔Human Attribution Ratio, Citation Frequency, Drop Detector Status
- Cartes : Quality Score, Fan-Out Clusters, Drop Detector, Bot Mix
- Edge function : `geo-kpis-aggregate` (agrégation cron quotidien à 04h00)
- Sources : `bot_hits`, `log_entries`, `verification_status` (rDNS+ASN officiels)

### 3.3 Onglet Content (Editorial Dashboard)

**Edge function** : `cms-content-scan` (universal scanner)

- Détection automatique CMS (WordPress, Shopify, etc.) depuis l'URL
- Mode "Interne" pour `crawlers.fr` → SELECT direct sur `blog_articles` + `seo_page_drafts`
- Liste **toutes les pages** : actives + brouillons + même celles non générées par Crawlers
- Affiche : statut, last_modified, word_count, score SEO, score GEO
- Cron `cms-content-cache-refresh` (hebdo) pour rafraîchir les sites trackés

### 3.4 Onglet SERP (`SerpBenchmarkTab.tsx`)

**Edge function** : `serp-benchmark` (cf. `features/console/serp-benchmark-fr`)

- Agrège **4 providers en parallèle** : DataForSEO, SerpApi, Serper, Bright Data
- Calcule **position moyenne pondérée** + variance inter-providers
- Détecte divergences (signal de SERP volatile)
- Enrichit `keyword_universe` (SSOT mots-clés)
- Coût : 1 crédit par keyword (mutualisé entre providers)

### 3.5 Onglet SEA→SEO Bridge (`SeaSeoBridgeTab.tsx`)

**Edge function** : `sea-seo-bridge`

- Lecture **Google Ads API** (read-only) : campagnes, mots-clés, CPC, conversions
- Lecture **GA4 API** : sessions, événements, conversions par source
- Croisement avec audits SEO du site
- Identifie **gaps** : mots-clés performants en SEA mais absents/mal positionnés en SEO
- Output : table priorisée par ROI potentiel + actions suggérées (créer page, optimiser meta, etc.)

### 3.6 Onglet BigQuery (admin uniquement)

**Edge function** : `gsc-bigquery-query`

- Exécute SQL paramétré sur **GSC BigQuery export** (data fraîche j-2)
- Templates pré-définis : top queries, page-query matrix, CTR by position, etc.
- **Pas de SQL libre côté user** : whitelist de templates pour éviter injection
- Coût : compté par bytes scannés (BigQuery pricing)

---

## 4. Mes Sites > Onglet Concurrence

### 4.1 Frontend — `CompetitorTrackingTab.tsx`

**Limite** : 1-3 URLs concurrentes par site tracké (Pro Agency+ uniquement).

**UI** :
- Card par concurrent avec :
  - Score SEO (0-100) + delta vs son site
  - Score GEO décomposé : chunkability, structure, quotability
  - Score E-E-A-T
  - Position SERP moyenne sur mots-clés communs
  - **DeltaBadges** : badges colorés vert/rouge pour chaque métrique (variation depuis dernier audit)
- Bouton "Lancer audit" → `audit-competitor-url`
- Statut affiché : `pending` → `running` → `done` (ou `failed`)

### 4.2 Backend — `audit-competitor-url`

**Étapes** :
1. Fetch HTML du concurrent (via Browserless si JS-heavy)
2. Analyse SEO complète (meta, structure, schema, perf, mobile)
3. Analyse GEO (chunkability score, quotable passages, structure logique)
4. Analyse E-E-A-T (auteur, sources, témoignages, freshness)
5. Récupération **positions SERP** via DataForSEO sur les mots-clés du site principal
6. Persistance dans `competitor_tracked_urls` (status: `pending` → `running` → `done`)
7. Calcul deltas vs site principal → stockage dans `competitor_deltas`

**Données stockées** :
- `competitor_tracked_urls` : URL, status, timestamps, scores
- `competitor_audits` : raw_payload de chaque audit (historique)
- `competitor_deltas` : deltas calculés vs site owner pour DeltaBadges

### 4.3 Pression concurrentielle

Cf. `features/pro-agency/competitive-strategy-fr` :
- Switch "Priorisation par pression concurrentielle" dans le header de l'onglet
- Cadenas (gating) pour les utilisateurs sans Pro Agency+
- Quand activé : le calcul de `spiral_score` (Parménion) intègre `competitor_momentum_score` × 0.35

---

## 5. Architecture transverse

### 5.1 Modules partagés `_shared/`

| Module | Rôle |
|---|---|
| `_shared/editorialPipeline.ts` | Pipeline 4 étapes réutilisable |
| `_shared/fairUse.ts` | Quotas par plan + reset mensuel |
| `_shared/auditCache.ts` | Cache audits (TTL 24h, déduplication) |
| `_shared/cmsAdapters/*.ts` | Adapters par plateforme CMS |
| `_shared/geoScoring.ts` | Calcul scores GEO (chunkability, quotability) |
| `_shared/seoScoring.ts` | `computeSeoScoreV2` |

### 5.2 Pattern Async Job

Pour toutes les opérations >60s (audits longs, batch CMS, scan complet) :

1. Frontend appelle l'edge function avec `{ async: true }`
2. Backend insère dans `async_jobs` avec `status='queued'`, retourne `job_id` immédiatement
3. Worker (cron 1min) consomme via `claim_jobs(batch_size, worker_id)` (FOR UPDATE SKIP LOCKED)
4. Frontend polle `GET /async-job-status?id={job_id}` toutes les 3s
5. À la fin : `status='completed'` + `result` JSONB → frontend récupère et rend

### 5.3 Sécurité

- **RLS partout** : `owns_tracked_site(site_id)` ou `auth.uid() = user_id`
- **Tracking coûts LLM** : `agent_token_costs` (par user × persona × jour)
- **Rate limiting** : `check_rate_limit('action_name', max, window_minutes)`
- **Sanitization HTML** : DOMPurify côté serveur avant publication CMS
- **Validation Zod** sur tous les bodies edge functions
- **JWT obligatoire** sauf endpoints publics (sitemap, robots, render-page)

---

## 6. Tables principales

| Table | Rôle |
|---|---|
| `content_drafts` | Brouillons Content Architect (avant publication) |
| `architect_workbench` | Recos atomiques (source of truth pour Parménion) |
| `cluster_definitions` | Clusters thématiques + maturity_pct |
| `cms_connections` | Credentials chiffrés par site/user |
| `competitor_tracked_urls` | URLs concurrentes trackées (max 3/site) |
| `competitor_audits` | Historique audits concurrents |
| `competitor_deltas` | Deltas calculés vs site owner |
| `keyword_universe` | SSOT mots-clés (quick wins, gaps, missing terms) |
| `serp_benchmark_results` | Résultats multi-providers SERP |
| `indexation_history` | Séries temporelles statuts indexation GSC |
| `async_jobs` | File d'attente jobs longs |
| `agent_token_costs` | Tracking coûts LLM |

---

## 7. Cron jobs liés

| Cron | Fréquence | Edge function |
|---|---|---|
| `cocoon-refresh` | Hebdo (lundi 02h) | `cocoon-comprehensive-refresh` |
| `cms-content-cache-refresh` | Hebdo (mardi 03h) | `cms-content-scan` (batch sites Pro+) |
| `llm-saturation-analysis` | Hebdo (mercredi 04h) | `analyze-llm-saturation` |
| `geo-kpis-aggregate` | Quotidien (04h) | `geo-kpis-aggregate` |
| `cron-geo-pipeline` | Quotidien (05h) | Pipeline GEO complet (Shields actifs uniquement) |
| `bot-attribution-snapshot` | Hebdo (lundi 06h) | Snapshot 30j Bot↔Human |
| `counter-audit` | 24h après deploy | Validation post-déploiement Parménion |

---

## 8. Fichiers clés

### Content Architect
- `src/components/Cocoon/CocoonContentArchitectModal.tsx` — modal éditeur
- `src/contexts/ContentArchitectContext.tsx` — état partagé
- `src/components/Cocoon/panels/*.tsx` — 8 panneaux
- `supabase/functions/content-architecture-advisor/index.ts` — pipeline 4 étapes
- `supabase/functions/cms-publish-draft/index.ts` — création contenu CMS
- `supabase/functions/cms-patch-content/index.ts` — modification contenu CMS
- `supabase/functions/generate-image/index.ts` — routeur images

### Console
- `src/pages/Console.tsx` — page racine 5 onglets
- `src/components/Console/IndexationMonitor.tsx`
- `src/components/Console/GeoConsoleTab.tsx`
- `src/components/Console/EditorialDashboard.tsx`
- `src/components/Console/SerpBenchmarkTab.tsx`
- `src/components/Console/SeaSeoBridgeTab.tsx`
- `src/components/Console/BigQueryTab.tsx`
- `supabase/functions/check-indexation/index.ts`
- `supabase/functions/serp-benchmark/index.ts`
- `supabase/functions/sea-seo-bridge/index.ts`
- `supabase/functions/gsc-bigquery-query/index.ts`

### Concurrence
- `src/components/MesSites/CompetitorTrackingTab.tsx`
- `src/components/MesSites/DeltaBadges.tsx`
- `supabase/functions/audit-competitor-url/index.ts`

---

*Document maintenu par l'équipe technique Crawlers. Dernière mise à jour : Avril 2026.*
