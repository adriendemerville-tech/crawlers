---
name: Update Pipeline Sprints 1-2
description: Pipeline Refresh — table update_artifacts + 4 skills atomiques (extract, claims, topic_gaps, guidance) + UI groupée par slug avec pastilles d'avancement
type: feature
---

# Pipeline Update — Sprints 1 & 2

Modèle inspiré d'Anthropic Content Update Skills : décomposition en **skills atomiques rejouables** avec artefacts persistés (équivalent fichiers `.md` versionnés).

## Architecture

**Table `update_artifacts`** (multi-tenant strict via `auth.uid()`) :
- `stage` ∈ {`extracted`, `guidance`, `claims`, `topic_gaps`, `mentions`, `draft`}
- `payload` jsonb (tout le résultat de la skill)
- `expires_at` TTL 30 jours
- Index unique `(user_id, slug, stage)` → upsert pour rejouer une étape sans dupliquer
- `source` ∈ {`strategic_monitoring`, `manual`, `copilot`}

**Helper partagé** : `supabase/functions/_shared/updatePipelineGuards.ts`
- `authAndGate(req)` : auth + gating Premium+ (set `PREMIUM_PLANS`)
- `getExtractedArtifact(admin, userId, slug)` : récupère l'artefact base
- `upsertArtifact(...)` : upsert avec TTL 30j

## Edge functions

### Sprint 1
**`update-extract-content`** — scrape HTML, extrait title/meta/og/canonical/H1-H3/word_count/links → upsert stage=`extracted`.

### Sprint 2
**`update-claims-audit`** — extrait phrases "claimables" (stat/date/superlative/quote/study), vérifie chaque claim via SerpAPI (5 résultats Google), verdict ∈ {verified/unverified/contradicted/unknown} + confidence + sources. Persiste stage=`claims`. Requiert `SERPAPI_KEY` (sinon retourne candidats sans vérification).

**`update-topic-gaps`** — compare la couverture sémantique (unigrams + bigrams sur H1-H3) contre 1-3 concurrents. Réutilise `audit-competitor-url` pour récupérer la structure ; fallback scrape direct. Calcule `coverage_score` (% topics couverts vs union concurrents) + liste des gaps présents chez ≥2 concurrents. Persiste stage=`topic_gaps`.

**`update-guidance`** — synthèse LLM (Gemini 2.5 Flash via Lovable AI Gateway) de l'extraction + claims + topic_gaps en un brief JSON déterministe : `{ angle, target_intent, must_keep[], must_add[], must_fix[], sections[], internal_links_suggested[], estimated_word_count }`. Persiste stage=`guidance`.

## UI

Onglet **"Refresh"** dans `MyContent` (Profile > Content) — composant `UpdatePipelinePanel` :
- Form URL → bouton Extraire
- Liste **regroupée par slug** (un slug = un pipeline complet pour une page)
- Chaque carte affiche :
  - Pastilles colorées par stage (Extrait / Claims / Gaps / Brief / Mentions / Draft)
  - Section déroulante avec 3 actions Sprint 2 :
    - **Audit des claims** (1 clic)
    - **Gaps thématiques** (input pour 1-3 URLs concurrentes, séparées par espace/virgule)
    - **Brief de refonte** (LLM)
  - Aperçus payload : compteurs claims (verified/unverified/contradicted), top gaps, angle + must_fix/must_add du brief
- Gate visible (Lock + message) pour plans non-Premium

## Sprint 3 planifié

- **`update-internal-mentions`** : scan du site pour suggérer ancres internes vers la page refondue
- **`update-draft-consolidate`** : branche `editorial-pipeline-run` (4-stages) avec le brief en input + diff UI
- **Publication** : bouton → `cms-push-draft` mode patch (pas create) sur les 7 plateformes
- **Déclencheur final** : Strategic Monitoring (pages en déclin → bouton "Lancer pipeline Refresh")

## Réutilisations

- `serpapi-actions` (indirect, via fetch direct SerpAPI dans claims-audit)
- `audit-competitor-url` pour la couverture concurrents
- `editorial-pipeline-run` (sprint 3)
- `cms-push-draft` 7 plateformes en mode patch (sprint 3)
- `anti-cannibalization` + `dedup-synonym` guard avant publication (sprint 3)
