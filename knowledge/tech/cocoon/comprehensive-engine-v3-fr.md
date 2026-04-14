# Memory: tech/cocoon/comprehensive-engine-v3-fr
Updated: 2026-04-14

## Moteur Cocoon v3 — Graphe Sémantique & Stratège

### Architecture
1. **Graphe** : Orienté et pondéré. Calculé par `calculate-cocoon-logic` à partir du dernier crawl `completed` (≥ 2 pages, domaine normalisé www vs root).
2. **Depth** : `semantic_nodes.depth` = `crawl_depth` (BFS, calculé par le crawler). Avant fix: depth était 0/1 (seed/member de cluster). Maintenant: reflète la vraie profondeur BFS pour un placement radial correct.
2. **Cannibalisation** : Priorité critique (x9 dans le scoring).
3. **Auto-maillage IA** : Identifie des ancres sémantiques et injecte des liens contextuels via `cocoon_auto_links`.

### Crawl Depth — Signal Stratégique (v3.1)
- **Source** : `crawl_depth` calculé par BFS dans `duplicateDetector.ts` → finalisé dans `finalizer.ts` → persisté dans `crawl_pages`.
- **Diagnostic** (`cocoon-diag-structure`) : Détecte les pages à profondeur > 3 avec métadonnées enrichies :
  - `deep_pages_detail` : liste triée par profondeur (url, depth, path) — top 15
  - `suggested_link_sources` : pages à depth 0-1 avec peu de liens sortants — candidates idéales pour réduire la profondeur
  - `depth_distribution` : histogramme { depth → count }
  - `avg_site_depth` et `pct_deep` : indicateurs globaux
- **Stratège** (`cocoon-strategist`) :
  - Convertit le finding `deep_pages` en tâche `add_internal_link` actionnable (pas juste `restructure_tree`)
  - Si > 30% des pages sont profondes → tâche supplémentaire `restructure_tree`
  - **Priority boost** basé sur la profondeur max : depth ≥ 5 → x1.5, depth ≥ 4 → x1.3, sinon x1.1
  - Les métadonnées incluent `suggested_link_sources` pour que l'auto-maillage sache d'où créer les liens

### UI/UX
- Vue 3D, Radiale et X-Ray avec filtres de direction (descending, ascending, lateral).
- Sélecteur de crawl avec filtre strict `completed` + ≥ 2 pages.
- Badge crawl_depth affiché sur chaque nœud dans le panneau de détail.

### Stratège Cocoon
- Recommandations on-site uniquement (pas d'actions off-site).
- Tutoiement et mémoire persistante (TIM).
- 4 diagnostics parallèles : content, semantic, structure, authority.
- Budget de tâches configurable (max 12/cycle).
- 3 axes stratégiques priorisés.
- Feedback loop sur recommandations passées.
