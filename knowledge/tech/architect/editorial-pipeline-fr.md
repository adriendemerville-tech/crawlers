# Memory: tech/architect/editorial-pipeline-fr
Updated: 2026-04-16

## Pipeline éditoriale 4-étapes (Content Architect, Parménion, Social Hub)

### Architecture
Service partagé `_shared/editorialPipeline.ts` exposé via la edge function `editorial-pipeline-run`. Pipeline orchestrée :

1. **Stage 0 — Briefing** : Aggregation `architect_workbench` (top 10 spiral_score) + `keyword_universe` (top 20 opportunités) + `seasonal_context` + `tracked_sites.business_profile`. Snapshot persisté dans `editorial_briefing_packets`.
2. **Stage 1 — Strategist** : LLM haute-réflexion qui produit `{angle, outline (H2[]), intent, target_length}`.
3. **Stage 2 — Writer** : LLM rédacteur qui produit `{title, content (Markdown), excerpt}` selon la stratégie.
4. **Stage 3 — Tonalizer** *(optionnel)* : LLM léger qui ajuste à la voix DNA si `voice_dna_strength > 0.6`.

Chaque stage logué dans `editorial_pipeline_logs` (latence, tokens_in/out, coût USD, modèle, status).

### Résolution des modèles (cascade)
1. **Manual override** (`override_models` dans le payload) — priorité absolue
2. **DB rule** — `editorial_llm_routing` WHERE `user_id + domain + content_type`
3. **Auto default** — matrice complexité (`CONTENT_TYPE_BASE_TIER × site_complexity`)
   - Tiers : `fast` (gemini-flash-lite) / `balanced` (gemini-flash) / `premium` (gpt-5-mini ou gpt-5)
   - Bump : sites > 5000 pages → +1 tier ; < 50 pages → -1 tier

### Intégrations (opt-in)
- **Social Hub** (`generate-social-content`) : flag `use_editorial_pipeline=true` dans le payload → court-circuit, fallback legacy si erreur
- **Content Architect** (`content-architecture-advisor`) : flag `use_editorial_pipeline=true` après validation des inputs → court-circuit, fallback legacy si erreur. Mapping `page_type → ContentType` (homepage/product/landing → landing_page, article → blog_article, faq → faq, category → seo_page).
- **Parménion** (`parmenion-orchestrator`) : opt-in via `autopilot_configs.use_editorial_pipeline`. Enrichit chaque action `emit_editorial_content` (create-post / create-page) en remplaçant `body.content/title/excerpt` par la sortie pipeline. Conserve les meta CMS-spécifiques. Fallback silencieux si erreur.

### UI Console (`/profile` > Content)
- **Routage LLM** (`EditorialLLMRoutingMatrix.tsx`) : matrice par domaine × content_type pour configurer Strategist/Writer/Tonalizer
- **Pipeline** (`EditorialPipelineObservability.tsx`) : derniers 25 runs avec latence cumulée, coût, modèles utilisés par stage
- **Alertes** (`EditorialPipelineAlerts.tsx`) : panneau de log des spikes coût (>$0.50), latence (>60s), taux d'erreurs
- **Badge** (`EditorialPipelineBadge.tsx`) : statut 7-jours par domaine (runs, latency, cost) via tooltip

### Tables
- `editorial_llm_routing` (user_id, domain, content_type, strategist_model, writer_model, tonalizer_model)
- `editorial_briefing_packets` (snapshots Stage 0)
- `editorial_pipeline_logs` (par stage : tokens_in/out, latency_ms, cost_usd, model_used)
- `editorial_pipeline_alerts` (severity, type, threshold_exceeded, acknowledged)
- `editorial_pipeline_status` (vue `security_invoker` : agrégats 7 jours par domaine)
- `autopilot_configs.use_editorial_pipeline` (boolean, default `false`)

### Edge functions associées
- `editorial-pipeline-run` : orchestration des 4 stages
- `editorial-pipeline-health` : maintenance (scan logs 1h, déclenche les alertes adaptatives)

### Default OFF
Pour limiter le risque de régression, l'opt-in pipeline est **désactivé par défaut** sur tous les sites. Activation explicite via `autopilot_configs.use_editorial_pipeline=true` (Parménion) ou flag dans le payload (Content Architect / Social Hub). Le legacy reste intact en fallback.

### Pilotes activés
- `iktracker.fr` : pipeline activée par défaut sur toutes les configs autopilot.
