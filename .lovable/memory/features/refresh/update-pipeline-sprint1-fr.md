---
name: Update Pipeline Sprint 1
description: Pipeline Refresh — table update_artifacts (6 stages, TTL 30j, RLS auth.uid) + skill atomique update-extract-content (gating Premium+) exposée via tab Refresh dans Console > Content
type: feature
---

# Pipeline Update — Sprint 1 (Fondations + Extract)

Inspiré du modèle Anthropic (Content Update Skills) : décomposition d'une refonte de page en **skills atomiques rejouables** avec artefacts persistés.

## Architecture

**Table `update_artifacts`** (multi-tenant strict via auth.uid) :
- `stage` ∈ {`extracted`, `guidance`, `claims`, `topic_gaps`, `mentions`, `draft`}
- `payload` jsonb (équivalent fichier `.md` du modèle Anthropic)
- `expires_at` TTL 30 jours
- Index unique `(user_id, slug, stage)` → upsert pour rejouer une étape sans dupliquer
- `source` ∈ {`strategic_monitoring`, `manual`, `copilot`}

## Edge function Sprint 1

**`update-extract-content`** :
- Auth obligatoire + gating plans Premium+ (`premium`, `premium_yearly`, `agency_pro`, `agency_premium`, `pro_agency`)
- Scrape HTML, extrait : title, meta, og, canonical, H1-H3, word_count, links (internal/external)
- Upsert artefact stage=`extracted`
- Renvoie `{ artifact_id, slug, payload }`

## UI

Nouvel onglet **"Refresh"** dans `MyContent` (Profile > Content) :
- Composant `UpdatePipelinePanel` (lazy)
- Form URL → bouton Extraire
- Liste des 20 derniers artefacts `extracted` avec carte expandable (meta, H1-H3, stats)
- Gate visible (Lock + message) pour plans non-Premium

## Sprints suivants planifiés

- **Sprint 2** : `update-guidance` + `update-claims-audit` (SerpAPI) + `update-topic-gaps` (réutilise `audit-competitor-url`)
- **Sprint 3** : `update-internal-mentions` + `update-draft-consolidate` (branche `editorial-pipeline-run`) + diff UI + publication via `cms-push-draft` mode patch
- **Déclencheur final** : Strategic Monitoring (pages en déclin → bouton "Lancer pipeline Refresh")

## Réutilisations

- `editorial-pipeline-run` (4-stages briefing→stratège→rédacteur→tonalisateur) en sprint 3
- `audit-competitor-url` pour topic gaps en sprint 2
- `anti-cannibalization` + `dedup-synonym` guard avant publication
- `cms-push-draft` 7 plateformes en mode patch (pas create)
