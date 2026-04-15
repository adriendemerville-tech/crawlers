# Memory: tech/cocoon/comprehensive-engine-v3-fr
Updated: 2026-04-15

## Moteur Cocoon v3 — Graphe Sémantique & Stratège

### Architecture
1. **Graphe** : Orienté et pondéré. Calculé par `calculate-cocoon-logic` à partir du dernier crawl `completed` (≥ 2 pages, domaine normalisé www vs root).
2. **Depth** : `semantic_nodes.depth` = `crawl_depth` (BFS, calculé par le crawler). Avant fix: depth était 0/1 (seed/member de cluster). Maintenant: reflète la vraie profondeur BFS pour un placement radial correct.
2. **Cannibalisation** : Priorité critique (x9 dans le scoring).
3. **Auto-maillage IA** : Identifie des ancres sémantiques et injecte des liens contextuels via `cocoon_auto_links`.

### Scoring Qualité Déterministe (v3.3)
- **Module partagé** : `_shared/crawlPageQuality.ts` — `computeCrawlPageQuality(page, profile?)`
- **Score** : 0-100, composite sur 6 axes (word_count, meta_tags, headings, links_in, links_out, seo_score)
- **Adaptation** : Pondérations ajustées par `BusinessProfile` (local_business, ecommerce, saas, editorial, agency)
- **Stratège** : Boost priorité des tâches — pages faibles (≤ 30) → x1.4, pages fortes (> 70) → x0.9
- **Auto-linking** : Re-rank des cibles par score qualité (top 30 → top 20 après scoring)
- **Coût** : 0 token LLM, ~2ms par page

### Crawl Depth — Signal Stratégique (v3.1)
- **Source** : `crawl_depth` calculé par BFS dans `duplicateDetector.ts` → finalisé dans `finalizer.ts` → persisté dans `crawl_pages`.
- **Diagnostic** (`cocoon-diag-structure`) : Détecte les pages à profondeur > 3, les fils d'Ariane manquants et les incohérences breadcrumb/depth :
  - `deep_pages_detail` : liste triée par profondeur (url, depth, path) — top 15
  - `suggested_link_sources` : pages à depth 0-1 avec peu de liens sortants — candidates idéales pour réduire la profondeur
  - `depth_distribution` : histogramme { depth → count }
  - `avg_site_depth` et `pct_deep` : indicateurs globaux
  - `missing_breadcrumbs` : pages indexables (depth > 0) sans schema BreadcrumbList — severity critical si > 70%
  - `breadcrumb_depth_mismatch` : pages dont la profondeur URL et crawl diffèrent de 3+ niveaux
  - `avg_site_depth` et `pct_deep` : indicateurs globaux
- **Stratège** (`cocoon-strategist`) :
  - Convertit le finding `deep_pages` en tâche `add_internal_link` actionnable (pas juste `restructure_tree`)
  - Si > 30% des pages sont profondes → tâche supplémentaire `restructure_tree`
  - **Priority boost** basé sur la profondeur max : depth ≥ 5 → x1.5, depth ≥ 4 → x1.3, sinon x1.1
  - Les métadonnées incluent `suggested_link_sources` pour que l'auto-maillage sache d'où créer les liens

### Déploiement de liens — Injection intelligente 3 tiers (v3.2)
Le déploiement des liens via `cocoon-deploy-links` utilise une stratégie d'injection contextuelle en 3 niveaux :

1. **Tier 1 — Wrap direct** : Si le texte d'ancre existe déjà dans le contenu HTML de la page source, il est wrappé in-situ dans un `<a href>` (regex avec lookbehind/ahead pour éviter les double-liens).
2. **Tier 2 — Context sentence** : Si l'ancre n'est pas trouvée mais qu'un `context_sentence` a été généré par `cocoon-bulk-auto-linking`, cette phrase (contenant déjà l'ancre) est insérée avant la conclusion de l'article via `insertBeforeLastParagraph()`.
3. **Tier 3 — Phrase-pont IA** : En dernier recours, `generateBridgeSentence()` appelle Gemini Flash Lite (`google/gemini-2.5-flash-lite`) pour produire une phrase de transition naturelle (max 30 mots) intégrant l'ancre. Le modèle reçoit un extrait de 500 caractères du contenu pour le contexte.
4. **Fallback ultime** : Si l'IA n'est pas disponible, une phrase générique « Pour aller plus loin, consultez notre ressource sur [ancre] » est insérée.

**Placement** : Toutes les insertions (tiers 2-4) sont placées via `insertBeforeLastParagraph()` qui trouve le dernier `<p>` du contenu et insère avant, pour un placement naturel dans la zone de conclusion.

**Pipeline données** : Le champ `context_sentence` est propagé depuis `cocoon_auto_links` → `CocoonTaskPlanModal` → `cocoon-deploy-links` pour alimenter le tier 2.

### Deux chemins de déploiement
- **IKtracker** : GET contenu via API → injection 3 tiers dans le HTML → PUT contenu modifié. Nécessite `IKTRACKER_API_KEY`.
- **Widget/WordPress** : Génération d'un script JS vanilla stocké dans `site_script_rules` (payload_type `COCOON_LINKS`). Le script parcourt le DOM côté client avec `TreeWalker` pour wrapper les ancres trouvées.

### UI/UX
- Vue 3D, Radiale et X-Ray avec filtres de direction (descending, ascending, lateral).
- **Filtre par cluster** : sélection multiple avec compteur actif/total, reset rapide.
- Sélecteur de crawl avec filtre strict `completed` + ≥ 2 pages.
- Badge crawl_depth affiché sur chaque nœud dans le panneau de détail.
- Les boutons quick-reply du Stratège envoient directement sans polluer le champ de saisie.

### Stabilité & Isolation
- Les `useEffect` de chargement dépendent de `user?.id` (pas de la ref objet) pour éviter les re-renders en cascade.
- Un garde-fou `sitesLoadedForUser` ref empêche les rechargements multiples des sites.
- `findReadySite` filtre par `user_id` sur les deux tables (site_crawls ET audits).
- RLS actif sur `semantic_nodes`, `audits`, `tracked_sites` : isolation totale par `auth.uid() = user_id`.

### Stratège Cocoon
- Recommandations on-site uniquement (pas d'actions off-site).
- Tutoiement et mémoire persistante (TIM).
- 4 diagnostics parallèles : content, semantic, structure, authority.
- Budget de tâches configurable (max 12/cycle).
- 3 axes stratégiques priorisés.
- Feedback loop sur recommandations passées.
