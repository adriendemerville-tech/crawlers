
# Plan — Saturation Intelligence v1 (Breathing Spiral)

## Objectif
Alimenter le pipeline éditorial avec un signal hebdomadaire sur la **saturation thématique** des clusters prioritaires, pour éviter la redondance et concentrer la production sur les vrais gaps.

## Stack LLM (Option A — économique)
- **Batch intent extraction** : `google/gemini-3-flash-preview`
- **Cluster synthesis** : `google/gemini-2.5-pro`
- Coût ~0,09 €/site/semaine
- Fallback OpenRouter automatique via `_shared/lovableAI.ts`

---

## Job 1 — `cron-cocoon-refresh` (dimanche 02:00 UTC) ✅
- Recalcule le graphe cocoon (`calculate-cocoon-logic`) pour chaque site `weekly_refresh_enabled=true`
- Skip si `last_cocoon_refresh_at > now()-7d`
- Budget : 8 min, délai 1.5s entre sites

## Job 2 — `cron-cms-content-refresh` (dimanche 03:00 UTC) ✅
- Rafraîchit le cache contenu CMS (wpsync / iktracker-actions / cms-content-stats)
- Skip Wix/Webflow (read-only)
- Budget : 8 min, délai 2s entre connexions

## Job 3 — `cron-saturation-analysis` (dimanche 04:00 UTC) ✅
- Sélectionne top 5 clusters prioritaires par site (spiral_score ≥ 50 OU maturité < 60%)
- **Étape 1** Gemini 3 Flash : extraction intent + angle pour chaque page du cluster (batch)
- **Étape 2** Gemini 2.5 Pro : synthèse `{saturation_score, dominant_angles, angle_gaps, recommendation}`
- Persistance dans `saturation_snapshots`

---

## Schéma & intégration ✅
- Table `saturation_snapshots` (clusters JSONB, global_score, generated_at)
- Colonnes `tracked_sites` : `last_cocoon_refresh_at`, `last_cms_refresh_at`, `last_saturation_at`, `weekly_refresh_enabled`
- Pipeline éditorial Stage 0 enrichi : `competitor_gaps` ← angle_gaps + `business_context.saturation_intel` ← snapshot complet
- Fallback non-bloquant si snapshot absent

---

## Documentation ✅
- `mem://tech/autopilot/saturation-intelligence-fr` — mémoire technique
- Index mémoire mis à jour
- Landing pages Breathing Spiral & Cocoon : section "Intelligence de saturation hebdomadaire"

---

**Statut : déployé. Premier cycle prévu dimanche 04:00 UTC.**
