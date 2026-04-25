---
name: Content Architect & Console — Architecture détaillée
description: Documentation technique exhaustive du Content Architect (modal éditeur + pipeline éditoriale 4-étages + publication CMS) et des modules de l'onglet Console (Indexation, SERP Benchmark, SEA→SEO, GSC BigQuery), plus l'onglet Concurrence de Mes Sites.
type: feature
---

# Content Architect & Console — Architecture détaillée

> Trois zones produit distinctes mais reliées : **Content Architect** (création/édition de pages), **Console** (intelligence éditoriale & monitoring), **Mes Sites > Concurrence** (benchmark concurrentiel). Toutes partagent les mêmes briques : `tracked_sites`, `_shared/getSiteContext`, `editorialPipeline`, `cms-*` et la matrice de scoring.

---

## 1. Cartographie d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND                               │
│                                                                 │
│  /app/cocoon  ───► CocoonContentArchitectModal                  │
│                       │ (toolbar 8 panels + preview)            │
│                       ▼                                         │
│              ContentArchitectProvider (context)                 │
│                                                                 │
│  /app/console ───► ConsoleSidebar (tracking, geo, indexation,   │
│                    sea-seo, gsc-bigquery, drafts, gmb, marina…) │
│                                                                 │
│  /profile ──► MyTracking ──► <Tabs.competitors>                 │
│                                  └─► CompetitorTrackingTab      │
└──────────────────────┬──────────────────────────────────────────┘
                       │  supabase.functions.invoke()
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                       EDGE FUNCTIONS                            │
│                                                                 │
│  Content Architect : cocoon-strategist · extract-architect-     │
│   fields · content-architecture-advisor (legacy + pipeline)     │
│   · generate-image · cms-publish-draft · cms-patch-content      │
│                                                                 │
│  Console : check-indexation · serp-benchmark · sea-seo-bridge   │
│   · gsc-bigquery-query · google-ads-connector · gsc-auth        │
│                                                                 │
│  Concurrence : audit-competitor-url                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  TABLES : tracked_sites · cocoon_architect_drafts ·             │
│   content_prompt_presets · seo_page_drafts · blog_articles ·    │
│   competitor_tracked_urls · indexation_checks · serp_benchmarks │
│   · sea_seo_opportunities · async_jobs · architect_workbench    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Content Architect

### 2.1 Frontend — entrées

| Surface | Fichier | Rôle |
|---|---|---|
| Landing marketing publique | `src/pages/ContentArchitectPage.tsx` (978 l.) | Présentation produit, **aucune logique métier** — uniquement Helmet + sections marketing. |
| Modal éditeur (réel) | `src/components/Cocoon/CocoonContentArchitectModal.tsx` (768 l.) | Éditeur Canva-like ouvert depuis Cocoon, Workbench, Mes Sites. |
| Contexte partagé | `src/contexts/ContentArchitectContext.tsx` | État cross-panels (champs édités, images générées, draft chargé). |
| Toolbar + 8 panels | `src/components/Cocoon/ContentArchitect{Toolbar,PromptPanel,StructurePanel,ImagePanel,OptionsPanel,StructuredDataPanel,DraftPanel,LibraryPanel,TasksPanel,QuickWinsPanel,Preview}.tsx` | UI verticale ; un seul panel ouvert à la fois (largeur 260-500 px). |

**Props clés du modal** : `nodes, domain, trackedSiteId, hasCmsConnection, draftData, prefillUrl, prefillPrompt, isExistingPage, demoMode`.

**Charte UI** : aucun bouton de fond, bordure + texte (`border border-foreground / text-foreground / hover:border-primary`).

### 2.2 Cycle de vie du modal

```
isOpen=true
  ├─► fetch cocoon_architect_drafts (latest pour `domain`)
  │     ├─ trouvé → applyDraft()
  │     └─ vide   → runStrategestPreCall()
  │                   ├─ invoke('cocoon-strategist', { tracked_site_id, domain, task_budget:3, lang })
  │                   ├─ filtre tasks.execution_mode==='content_architect' (top 5)
  │                   └─ invoke('extract-architect-fields', { message_content, domain, language })
  │                         └─ Gemini Flash → { draft } → applyDraft()
  ├─► fetch architect_workbench findings (top 3) → suggère keyword, competitor_url, instructions
  ├─► fetch content_prompt_presets (is_default=true, page_type) → injecte prompt par défaut
  ├─► auto-detect page_type via path du `directory`
  ├─► auto-generate slug via `generateSlugFromKeyword(keyword)`
  └─► auto-select directory selon `pageType`

User clique "Générer" :
  invoke('content-architecture-advisor', { url, keyword, keywords, page_type,
    tracked_site_id, content_length, custom_prompt, cta_link, photo_url,
    competitor_url, tone, target_audience_segment })
  → setResult(data.data) + setOriginalResult(deep clone) + ferme le panel actif

User clique "Publier" :
  imageData = generatedImages.filter(img => img.placement)
  fn = isExistingPage ? 'cms-patch-content' : 'cms-publish-draft'
  invoke(fn, { tracked_site_id, result_data, original_result_data:isEdited?orig:null,
    url, keyword, images })

User clique "Enregistrer" :
  insert cocoon_architect_drafts { user_id, domain, tracked_site_id, draft_data, source_message }
```

### 2.3 Edge function `content-architecture-advisor` (1 573 l.)

**Cœur de la génération.** Deux modes :

#### Mode legacy (single-LLM)
- Construit un brief via `_shared/contentBrief.ts` (mots-clés DataForSEO, SERP, Identity Card).
- Pré-crawl HTML compétiteur via Firecrawl + analyse TF-IDF.
- 1 appel LLM avec system prompt enrichi (`injectionPoints`, `matriceHtmlAnalysis`).

#### Mode Editorial Pipeline (recommandé)
Activé par `body.use_editorial_pipeline = true`. Court-circuite le legacy et appelle `runEditorialPipeline()` (`_shared/editorialPipeline.ts`) :

```
Stage 0 — Briefing aggregator
   • workbench findings + breathing spiral phase + keyword_universe
   • seasonal_context + business_context (tracked_sites)
   • Output: BriefingPacket { angle_hints, keywords, competitor_gaps, … }

Stage 1 — Strategist LLM (high reasoning)
   • Choisit angle, intent, outline, target_length
   • Modèle par défaut routé via matrix : gemini-2.5-pro

Stage 2 — Writer LLM
   • Produit titre + corps complet + excerpt
   • Modèle adapté au content_type (gemini-pro / gpt-5)

Stage 3 — Tonalizer LLM (optionnel)
   • Réécrit selon tracked_sites.voice_dna
   • Skip si pas de voice_dna
```

Map `page_type → ContentType` :
```ts
homepage|landing|product → landing_page
article                  → blog_article
faq                      → faq
category                 → seo_page
```

**Async job pattern** : si l'appel risque de dépasser 60 s, le client peut envoyer `async: true` → l'edge function crée une ligne `async_jobs`, retourne `{ job_id, status:'pending' }`, et le client poll `GET ?job_id=xxx`. Statuts : `pending → running → completed | failed`.

**Garde-fous backend** :
- `getSiteContext()` charge la fiche `tracked_sites` (RLS).
- `checkFairUse()` + `checkMonthlyFairUse()` bloquent les abus.
- `auditCache` (cacheKey/getCached/setCache) évite les regénérations.
- `trackTokenUsage` + `trackPaidApiCall` comptabilisent dans `agent_token_costs`.
- Service-role bypass : si `Authorization === SUPABASE_SERVICE_ROLE_KEY`, `user.id` vient de `body.user_id` (Parménion / Autopilot).

**Sortie standard** :
```ts
{
  success: true,
  source: 'editorial_pipeline' | 'legacy',
  pipeline_run_id?: string,
  briefing?, strategy?, draft?, final?,           // pipeline mode
  data: {                                          // legacy + UI consumer
    content_structure: {
      recommended_h1, introduction, tldr_summary,
      sections:[{ title, body_text, word_count }],
      hn_hierarchy, faq, media_recommendations,
    },
    seo_metadata: { meta_title, meta_description, og_title, og_description },
    metadata_enrichment: { json_ld_schemas:[{ type, properties }] },
    internal_linking: { recommended_internal_links, anchor_strategy },
  }
}
```

### 2.4 Edge function `cocoon-strategist` (1 694 l.)

Pré-appel stratégique invoqué au cold-start du modal. Renvoie `tasks[]` avec `execution_mode ∈ {content_architect, code_architect, manual, …}` ; le modal ne garde que celles destinées au contenu, les agrège en bullets, puis les fait extraire en champs structurés par `extract-architect-fields`.

### 2.5 Edge function `extract-architect-fields` (201 l.)

Petit utilitaire : prend une réponse texte de stratège + contexte, appelle `callLovableAIJson()` (Gemini Flash) avec un schéma JSON → renvoie `{ draft: { keyword, secondary_keywords, page_type, custom_prompt, h1_suggestion, competitor_url, cta_suggestion, priority_actions, tone } }`. Persiste dans `cocoon_architect_drafts`.

### 2.6 Edge function `generate-image`

Appelée par `ContentArchitectImagePanel` lors de la génération. Délègue à `_shared/imageGeneration.ts` qui route :
- **Imagen 3** (Google) → styles `photo`, `cinematic`, `reference_inspiration`.
- **FLUX** (BFL) → styles `artistic`, `flat`, `aquarelle`.
- **Ideogram** → styles `typography`, `infographic`, `bw`, `classical_painting`.

Sortie : `{ dataUri, style, model, latency_ms }`. Tracké via `trackTokenUsage`. Le double-clic dans le panel assigne `placement: 'header' | 'body'`.

### 2.7 Edge function `cms-publish-draft` (637 l.)

**Création** d'une nouvelle page sur le CMS connecté (`cms_connections`). Workflow :

1. Auth user (Bearer JWT).
2. Charge `cms_connections WHERE tracked_site_id = … AND status='connected'`.
3. **Build HTML** depuis `result_data.content_structure` :
   - header image (figure + alt généré via `generateImageAlt`)
   - `<h1>`, TL;DR, `<p class="introduction">`
   - sections H2 + paragraphes splittés sur `\n\n+` + H3 enfants (`parent_section_index`)
   - body image après section 2 (ou en fin si <2 sections)
   - FAQ `<details>/<summary>`
   - JSON-LD `<script type="application/ld+json">` par schéma
4. **Dispatch** par `platform` :
   - `wordpress` → POST `/wp-json/wp/v2/posts` ou `/pages` (Basic Auth ou Bearer)
   - `shopify` → POST `/admin/api/2024-01/articles.json` ou `/pages.json`
   - `drupal`, `wix`, `webflow`, `prestashop`, `odoo` → idem (APIs natives)
5. **Featured image** : POST media puis attache via `featured_media`.
6. Renvoie `{ ok, cms_post_id, post_url, status:'draft' }`. Statut `draft` toujours (jamais publication directe).

**Alt text auto** : `generateImageAlt(keyword, title, placement)` → `"Illustration {keyword} — {title}"` (header) ou `"{keyword} illustré dans {title}"` (body).

### 2.8 Edge function `cms-patch-content` (1 351 l.)

**Mise à jour granulaire** d'une page existante. Input :
```ts
{
  tracked_site_id: string,
  target_url: string,
  cms_post_id?: string,    // si connu, accélère
  patches: PatchOperation[],
}
PatchOperation = {
  zone: 'h1'|'h2'|'h3'|'meta_title'|'meta_description'|'faq'|'body_section'|
        'image'|'alt_text'|'author'|'excerpt'|'slug'|'tags'|'schema_org'|
        'canonical'|'robots_meta'|'og_title'|'og_description'|'og_image',
  action: 'replace'|'append'|'prepend'|'remove',
  selector?: string,        // ex: "h2:2"
  value: string|object,
  old_value?: string,       // aide au matching pour replace
}
```

Si l'API CMS ne supporte pas la zone → renvoie un **mode fallback** avec instructions structurées pour application manuelle. Utilisé aussi par la skill `cms_patch_content` du copilot-orchestrator.

---

## 3. Console (`/app/console`)

### 3.1 Sidebar et onglets

`src/components/Console/ConsoleSidebar.tsx` (292 l.) liste les valeurs : `tracking, geo, action-plans, corrective-codes, crawls, drafts (Content), sea-seo, indexation, gsc-bigquery, gmb, marina, reports, reports-tab, wallet, bundle (admin), settings, admin (creator)`.

Flags : `proOnly`, `adminOnly`, `hideOnMobile`, `beta`.

### 3.2 Onglet **Indexation** (`IndexationMonitor.tsx`)

UI : sélecteur de site, bouton « Auto-scan », champ d'inspection manuelle, table des `IndexationCheck` (verdict, coverage_state, last_crawl_time, etc.).

3 actions vers `check-indexation` :
| `body.action` | Effet |
|---|---|
| `list` | SELECT `indexation_checks WHERE tracked_site_id=… ORDER BY checked_at DESC`. |
| `scan-key-pages` | Récupère les top URLs (`gsc_pages` ou sitemap), passe chacune à GSC URL Inspection API via `resolveGoogleToken(user)`, agrège indexed/notIndexed. |
| `inspect` | Inspection unique d'une URL ; valide d'abord que `new URL(url).hostname == site.domain` côté client. |

Side-effect : après `scan-key-pages`, déclenche automatiquement `serpBenchmarkRef.current.triggerBenchmark(domain)`.

**Backend `check-indexation`** : appelle `searchconsole.googleapis.com/v1/urlInspection/index:inspect` avec le token Google de l'utilisateur (table `google_connections`). Persiste chaque verdict dans `indexation_checks`.

### 3.3 Onglet **GSC BigQuery** (`GscBigQueryExplorer.tsx` + `GscBigQuerySettings.tsx`)

Frontend = éditeur SQL paramétré + dataset picker. Backend `gsc-bigquery-query` exécute des **requêtes paramétrées** (jamais de SQL libre) sur le dataset BigQuery où l'utilisateur a configuré l'export GSC. Renvoie `{ rows, schema, bytes_processed, cost_estimate }`.

### 3.4 Onglet **SERP Benchmark** (`SerpBenchmark.tsx`, 498 l.)

UI : input mot-clé, picker location (city/region/country), 4 toggles providers (DataForSEO, SerpApi, Serper, Bright Data), penalty single-hit, table `AveragedSite` triée par moyenne pondérée.

**API** :
```ts
invoke('serp-benchmark', {
  action: 'benchmark',
  query, tracked_site_id?, target_domain?,
  location, language:'fr', country:'fr',
  single_hit_penalty: 0..N,
  providers: string[],
})
```

**Backend `serp-benchmark` (446 l.)** :
- Appelle en **parallèle** chaque provider configuré (clés env `DATAFORSEO_LOGIN/PASSWORD`, `SERPAPI_KEY`, `SERPER_KEY`, `BRIGHTDATA_KEY`).
- Pour chaque résultat (top 100), normalise `{ url, position, title, domain }`.
- Calcule `average = mean(positions across providers) + penalty if seen by < 2`.
- Persiste dans `serp_benchmarks` + `serp_benchmark_results`.
- `action: 'list'` retourne l'historique pour le site.

**Mode batch Pro Agency** : `runTopKeywordsBenchmark` charge `keyword_universe` (top 5 par `opportunity_score`), boucle avec sleep 1500 ms entre chaque benchmark.

`useImperativeHandle(ref, { triggerBenchmark })` → permet à `IndexationMonitor` de déclencher un benchmark sur le domaine après auto-scan.

### 3.5 Onglet **SEA→SEO Bridge** (`SeaSeoBridge.tsx`, 590 l.)

Croise mots-clés Google Ads + conversions GA4 + gaps Cocoon pour identifier des opportunités SEO non exploitées par le SEA.

**Actions vers `sea-seo-bridge` (455 l., READ-ONLY sur Google Ads)** :
| Action | Effet |
|---|---|
| `analyze` | searchStream Google Ads (SELECT keywords + conversions) → join avec GA4 + `cocoon_gaps` → renvoie `{ summary, opportunities[] }`. |
| `inject_workbench` | Push opportunités sélectionnées dans `architect_workbench` (avec `owns_tracked_site()` check). |

**`Opportunity.opportunity_type`** : `no_organic | low_organic | high_potential | cannibalisation_risk`.

**Connecteur** : `google-ads-connector` (init OAuth + refresh). Si non connecté, bouton « Connecter Google Ads ».

**Mode démo** (`useDemoMode`) : injecte `SIMULATED_OPPORTUNITIES` ; injection backend bloquée.

### 3.6 Autres onglets Console (résumé)

| Onglet | Fichiers | Edge function |
|---|---|---|
| `tracking` | `MyTracking.tsx` (intégré via Console) | — (lectures directes) |
| `geo` | `LLMVisibilityDashboard.tsx` | `marina-*` |
| `action-plans` | `MyActionPlans.tsx` | — |
| `corrective-codes` | `CorrectiveCodeEditor` | `generate-corrective-code` (async job pattern) |
| `crawls` | `CrawlsTab` | `crawl-site-comprehensive` |
| `drafts` (Content) | `DraftsTab` | lecture `seo_page_drafts`, `blog_articles` |
| `gmb` | `GMBDashboard` | `gmb-*` |
| `marina` | `Marina*` | `marina-orchestrator` |

`AnomalyAlertsBanner.tsx` (213 l.) : bandeau persistant en haut, lit `tracked_site_anomalies` et propose des CTA contextuels.

`GoogleServicesOnboardingModal.tsx` : OAuth GSC/GA4/Ads via `gsc-auth`.

---

## 4. Mes Sites > Onglet **Concurrence**

### 4.1 Frontend — `CompetitorTrackingTab.tsx` (610 l.)

Monté dans `MyTracking.tsx` :
```tsx
<TabsContent value="competitors">
  <CompetitorTrackingTab
    trackedSiteId={h.currentSite.id}
    domain={h.currentSite.domain}
    userId={h.user?.id}
    language={h.language} />
</TabsContent>
```

**Features** :
- **Ajout** : modal avec champ URL → normalise (`https://`, slash final), valide que `compDomain != domain`, **max 3 concurrents** par site, anti-doublon → INSERT `competitor_tracked_urls { user_id, tracked_site_id, competitor_url, competitor_domain, crawl_status:'pending' }` puis fire-and-forget `audit-competitor-url`.
- **Refresh** : remet `crawl_status='pending'` et relance l'audit.
- **Suppression** : DELETE direct sur la table.
- **Affichage** : pour chaque concurrent, MiniScoreWithRef(label, score, refScore) sur SEO, GEO, chunkability, structure, quotability, EEAT, semantic_richness, schema_count, JSON-LD, meta_desc, top10 SERP, relevance — chaque score affiche un `DeltaBadge` (vert si meilleur, rouge sinon) vs le site de référence.
- **Export CSV** : sérialise les concurrents `crawl_status='done'` avec toutes les métriques.
- **Modale détail** : drilldown sur `audit_data`, `crawl_data`, `serp_positions`, `semantic_relevance`.

### 4.2 Edge function `audit-competitor-url` (334 l.)

Appelée par `invoke('audit-competitor-url', { competitorUrl, competitorDomain, trackedSiteId, referenceDomain })`.

```
1. Fetch HTML (avec UA Crawlers) → analyzeHtmlFull(html) → HtmlData
2. Calcule métriques GEO :
   • computeChunkability(html) → { score, paragraphs, avgLength, hasToc }
   • computeStructureScore(hd) → { score, details }
   • computeQuotability(html) → { score, quotableCount, samples }
   • computeEeat(html) → signaux auteur/sources/dates
   • computeSemanticRichness(text)
3. SERP positions via DataForSEO (top keywords du site de référence)
4. UPDATE competitor_tracked_urls SET
     crawl_status='done', last_crawl_at=now(),
     seo_score, geo_score, serp_positions, semantic_relevance,
     crawl_data:{ html_meta, h1_count, … }, audit_data:{ chunkability, structure, … }
5. trackPaidApiCall(DataForSEO usage)
```

**Échecs** : `crawl_status='failed'`, `error_message` stocké.

### 4.3 Table `competitor_tracked_urls`

| Colonne | Type | Notes |
|---|---|---|
| `user_id`, `tracked_site_id` | uuid | RLS = owner. |
| `competitor_url`, `competitor_domain` | text | Unique par tracked_site. |
| `label` | text | Optionnel. |
| `crawl_status` | text | `pending → running → done | failed`. |
| `last_crawl_at` | timestamptz | |
| `seo_score`, `geo_score` | int | 0-100. |
| `serp_positions`, `semantic_relevance`, `crawl_data`, `audit_data` | jsonb | |

---

## 5. Tables centrales utilisées

| Table | Producteur | Consommateur |
|---|---|---|
| `cocoon_architect_drafts` | `extract-architect-fields`, modal "Enregistrer" | Pré-fill modal (latest par domain) |
| `content_prompt_presets` | UI Profil | Modal "auto-inject" prompt par `page_type` |
| `seo_page_drafts` / `blog_articles` | `cms-publish-draft` (statut=`draft`) | Console > Content + publication CMS finale |
| `architect_workbench` | `sea-seo-bridge` (inject), audits | Modal `findings` pour pré-fill keyword/competitor |
| `keyword_universe` | audit-strategique-ia, expert-audit | SerpBenchmark batch, modal autocomplete |
| `competitor_tracked_urls` | `audit-competitor-url` | CompetitorTrackingTab + audits comparatifs |
| `indexation_checks` | `check-indexation` | IndexationMonitor table |
| `serp_benchmarks` + `serp_benchmark_results` | `serp-benchmark` | SerpBenchmark history + IAS |
| `async_jobs` | `content-architecture-advisor`, `generate-corrective-code` | Polling `GET ?job_id=` |
| `cms_connections` | OAuth/onboarding CMS | `cms-publish-draft`, `cms-patch-content` |

---

## 6. Sécurité & garanties transverses

| Couche | Mécanisme |
|---|---|
| Auth | Toutes les edge functions vérifient `Authorization: Bearer <jwt>` puis `auth.getUser(token)`. `user.id` jamais lu depuis le body côté utilisateur. |
| Service-role bypass | Si `token === SUPABASE_SERVICE_ROLE_KEY` → autorisé pour appels internes (Parménion, Autopilot) avec `user_id` dans le body. |
| RLS | Lectures/mutations DB via `getUserClient(authHeader)` → policies `tracked_sites`, `competitor_tracked_urls`, etc. |
| Ownership | `owns_tracked_site(user_id, tracked_site_id)` vérifié avant toute injection workbench / publication CMS. |
| Fair-use | `_shared/fairUse.ts` (par-action + mensuel par plan) sur génération contenu et audits compétiteurs. |
| Cache | `_shared/auditCache.ts` (key = sha256 des params) évite les regénérations identiques < 24 h. |
| Token tracking | `trackTokenUsage` (LLM) + `trackPaidApiCall` (DataForSEO, SerpApi, Serper, BrightData, Imagen, FLUX, Ideogram) → `agent_token_costs`. |
| Long-running | `async_jobs` + waitUntil + polling pour les jobs > 60 s. |
| Read-only externes | `sea-seo-bridge` n'utilise QUE `searchStream` sur Google Ads (pas de mutation campagne). |

---

## 7. Charte UI rappelée

- Couleurs : violet, jaune d'or, noir, blanc.
- Boutons : **bordure + texte uniquement**, pas de fond plein. Mode sombre = bordure/texte blanc, mode clair = bordure/texte noir.
- Aucun emoji, aucun bleu typique IA.
- Markdown obligatoire pour le rendu des contenus générés (preview Content Architect).

---

## 8. Limites connues & dette

- Le legacy single-LLM de `content-architecture-advisor` reste actif tant que tous les `tracked_sites` n'ont pas un mapping pipeline éditoriale validé.
- `CompetitorTrackingTab` est limité à **3 concurrents/site** en dur — pas de plan tier supérieur exposé.
- `serp-benchmark` ne dédup pas inter-providers à l'URL exacte (les variantes `?utm=` peuvent compter en double).
- `cms-publish-draft` publie en `status:'draft'` même si l'utilisateur veut publier — la mise en ligne reste manuelle côté CMS (volontaire pour la sécurité).
- `cms-patch-content` retombe en mode "instructions manuelles" pour les CMS qui n'exposent pas les zones demandées (Wix limité, Odoo partiel).
- `IndexationMonitor` dépend de la connexion GSC active ; aucune fallback sitemap si GSC absent.
- Pas de WebSocket — `competitor_tracked_urls.crawl_status` est rafraîchi par re-fetch manuel ou polling sur action utilisateur.
