---
name: Cannibalisation — skill Copilot + garde Parménion
description: Clustering déterministe (0 LLM) partagé dans _shared/cannibalizationClusters.ts, utilisé par le skill detect_content_cannibalization et par le garde de saturation/pruning de Parménion (prescribe)
type: feature
---

## Source unique
`supabase/functions/_shared/cannibalizationClusters.ts`
- `computeCannibalization(supabase, { domain, threshold, pathPrefix })` → clusters, pilier, doublons, `report_markdown`.
- `evaluateTopicSaturation(result, topicText, { saturationSize, overlap })` → `blocked`, `matched`, `pruning_candidate`.
- Aucun appel LLM, aucun service role imposé (le client passé porte le RLS).

## Algorithme
Tokenisation slug + title + h1 (NFD, stopwords FR + bruit SEO, dé-pluralisation),
clustering glouton Jaccard ≥ seuil (défaut 0.45), pilier = `seo_score + min(40, word_count/50) + inbound*3 - depth*2`.

## Consommateurs
1. Skill Copilot `detect_content_cannibalization` — lecture seule, `auto` pour Félix et le Stratège Cocoon.
2. **Parménion, phase `prescribe`** :
   - calcule les clusters avant l'appel à `cocoon-strategist` et lui transmet
     `saturated_themes` + `cannibalization_summary` ;
   - filtre les tâches de création de contenu dont le sujet recouvre un cluster
     saturé (≥ 3 pages, Jaccard ≥ 0.5) ;
   - si toutes les tâches contenu sont bloquées et qu'un cluster est consolidable,
     injecte une tâche de **pruning** `fix_cannibalization`
     (`pruning: { pilier, duplicates, recommended: 'merge_then_301' }`) ;
   - si rien n'est exécutable → cycle `skipped` avec le motif de saturation.

## Contraintes
- Nécessite un crawl `completed` ; sinon le garde est non bloquant (log + poursuite normale).
