---
name: Cluster Diversity Engine
description: Forces Parménion to rotate across thematic clusters instead of repeating the same topic. SQL caps 2 items/cluster, prompt injects topic exploration map.
type: feature
---

## Moteur de diversité thématique — Parménion (2026-04-20)

### Problème racine
Parménion restait bloqué sur le même cluster thématique (ex: "indemnités kilométriques" pour iktracker.fr) cycle après cycle. La dédup par synonymes (Layer E) empêchait les doublons exacts mais ne forçait pas l'exploration de nouveaux territoires.

### Causes identifiées
1. **`score_spiral_priority`** triait par score DESC sans limite par cluster → les 8 slots allaient au même cluster
2. **Le prompt contenu** diversifiait les ANGLES (persona, actu, comparatif) mais pas les SUJETS/CLUSTERS
3. **Le pipeline éditorial 4-étages** (avec rédacteur en chef) était désactivé par défaut

### Corrections

#### 1. SQL — Cap 2 items par cluster (`score_spiral_priority`)
- Ajout d'un `ROW_NUMBER() OVER (PARTITION BY cluster_id)` → `WHERE cluster_rank <= 2`
- Force la rotation : si cluster A a 10 items, seuls les 2 meilleurs passent, libérant des slots pour les clusters B, C, D

#### 2. Prompt — Bloc "Rédacteur en Chef" (`parmenion-orchestrator`)
- Query `cluster_definitions` pour lister TOUS les clusters du site
- Analyse de couverture : articles existants mappés aux clusters par mots-clés
- Détection de **monotopie** : si tous les items workbench ciblent le même `cluster_id`
- En cas de monotopie → directive prioritaire : "choisis un cluster DIFFÉRENT parmi les underserved"
- **Topic suggestions** : `generateTopicSuggestions()` génère des pistes thématiques basées sur :
  - `target_audience` du site (indépendants, artisans, infirmiers, avocats, etc.)
  - `market_sector` (mobilité, comptabilité, fiscalité, transport)
  - Exclusion des `saturatedTopics` déjà identifiés

#### 3. Suggestions par audience
Dictionnaire de topics métier par segment d'audience :
- Indépendants → facturation électronique, cotisations, prévoyance, TVA
- Artisans → label RGE, assurance décennale, marchés publics
- Infirmiers → convention CPAM, CARPIMKO, DPC
- Commerçants → bail commercial, caisse certifiée
- etc. (10 segments configurés)

### Fichiers modifiés
- Migration SQL : `score_spiral_priority` avec `cluster_rank <= 2`
- `supabase/functions/parmenion-orchestrator/index.ts` : `topicExplorationBlock` + `generateTopicSuggestions()`
