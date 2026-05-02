---
name: Update Pipeline Sprints 1-3
description: Pipeline Refresh complet — table update_artifacts + 6 skills atomiques (extract, claims, topic_gaps, guidance, mentions, draft) + publication patch CMS via cms-patch-content
type: feature
---

# Pipeline Update — Sprints 1, 2 & 3

Modèle inspiré d'Anthropic Content Update Skills : décomposition en **skills atomiques rejouables** avec artefacts persistés (équivalent fichiers `.md` versionnés).

## Architecture

**Table `update_artifacts`** (multi-tenant strict via `auth.uid()`) :
- `stage` ∈ {`extracted`, `guidance`, `claims`, `topic_gaps`, `mentions`, `draft`}
- `payload` jsonb (tout le résultat de la skill)
- `expires_at` TTL 30 jours
- Index unique `(user_id, slug, stage)` → upsert pour rejouer une étape sans dupliquer
- `source` ∈ {`strategic_monitoring`, `manual`, `copilot`}

**Helper partagé** : `supabase/functions/_shared/updatePipelineGuards.ts`
- `authAndGate(req)` : auth + gating Premium+
- `getExtractedArtifact(admin, userId, slug)` : récupère l'artefact base
- `upsertArtifact(...)` : upsert avec TTL 30j

## Edge functions

### Sprint 1
**`update-extract-content`** — scrape HTML, extrait title/meta/og/canonical/H1-H3/word_count/links → upsert stage=`extracted`.

### Sprint 2
**`update-claims-audit`** — extrait phrases "claimables", vérifie via SerpAPI, verdict ∈ {verified/unverified/contradicted/unknown}.

**`update-topic-gaps`** — compare la couverture sémantique (unigrams + bigrams sur H1-H3) contre 1-3 concurrents. Réutilise `audit-competitor-url`.

**`update-guidance`** — synthèse LLM (Gemini 2.5 Flash) en brief JSON `{angle, target_intent, must_keep[], must_add[], must_fix[], sections[], internal_links_suggested[]}`.

### Sprint 3
**`update-internal-mentions`** — tokenise title+H1-H3, scanne `cocoon_pages` (même user/site) pour matcher des pages internes par mots-clés communs. Retourne suggestions classées par score (nb keywords matchés). Persiste stage=`mentions`.

**`update-draft-consolidate`** — assemble extracted + guidance + claims + topic_gaps + mentions en un `user_brief` Markdown, appelle `editorial-pipeline-run` (4-stages briefing→strategist→writer→tonalizer) puis persiste stage=`draft` avec `{title, excerpt, content_html, diff{old/new word_count, delta_words, delta_pct}, pipeline{strategist.angle, tonalizer_used, logs}}`. Requiert au minimum `guidance`.

**`update-publish-draft`** — convertit le draft en patches `{zone, action, value}` (h1 + meta_title + body_section + excerpt + meta_description) et appelle `cms-patch-content` en mode patch (pas create) sur la page d'origine. Préserve l'URL/slug existant.

## UI

Onglet **"Refresh"** dans `MyContent` (Profile > Content) — composant `UpdatePipelinePanel` :
- Form URL → bouton Extraire
- Liste **regroupée par slug** avec pastilles 6 stages (Extrait / Claims / Gaps / Brief / Mentions / Draft)
- Actions Sprint 2 : Audit claims, Gaps thématiques (1-3 URLs), Brief LLM
- Actions Sprint 3 : Mentions internes, Consolider draft (gating sur guidance présent), bouton **Publier (patch CMS)** visible uniquement quand draft existe (avec confirm())
- Aperçus payload : ClaimsPreview, TopicGapsPreview, GuidancePreview, **MentionsPreview** (suggestions × score), **DraftPreview** (diff mots + angle + tonalizer)
- Gate visible (Lock + message) pour plans non-Premium

## Réutilisations

- `serpapi-actions` (claims-audit)
- `audit-competitor-url` (topic-gaps)
- `editorial-pipeline-run` (draft-consolidate)
- `cms-patch-content` (publish-draft, mode patch ≠ create)
- `cocoon_pages` (mentions internes)

## Déclencheur final (à brancher)

Strategic Monitoring : pages en déclin → bouton "Lancer pipeline Refresh" qui invoque `update-extract-content` puis enchaîne automatiquement claims/gaps/guidance via un orchestrateur léger (cron ou queue), source=`strategic_monitoring`.
