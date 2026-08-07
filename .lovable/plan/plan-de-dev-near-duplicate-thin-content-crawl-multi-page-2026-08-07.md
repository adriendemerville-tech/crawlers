# Plan de dev — Near duplicate & Thin content (crawl multi-page)

Objectif : remplacer la détection actuelle (hash exact + seuil 100 mots) par deux
analyses déterministes robustes, qualifiées selon la carte d'identité du site, et
consommables par Marina, Parménion et le Stratège Cocoon.

## 1. Périmètre & état actuel

- `_shared/crawlQueue/duplicateDetector.ts` : compare des `content_hash` exacts.
  Il étiquette `near_duplicate_content` alors qu'il ne détecte que du **duplicata strict**.
- Thin content : aujourd'hui un simple `word_count < 100` dans les issues de page.
- Le finalizer de crawl (`crawlQueue/finalizer.ts`) est le seul point de sortie
  cross-pages : c'est là que les deux analyses s'insèrent.
- Marina passe par `_shared/preCrawlForAudit.ts` puis pousse ses constats dans
  `architect_workbench` via `_shared/marinaWorkbench.ts`.
- Parménion (`parmenion-orchestrator`) et le Stratège lisent `architect_workbench`
  et les clusters de cannibalisation.

## 2. Architecture retenue

Un module partagé unique, appelé depuis les deux pipelines :

```text
_shared/contentIntegrity/
├── normalize.ts        extraction texte utile + retrait boilerplate
├── simhash.ts          shingles 5-grams -> SimHash 64 bits + Hamming
├── nearDuplicate.ts    clustering par similarité (Jaccard/cosine de contrôle)
├── thinContent.ts      score composite de minceur
├── qualify.ts          verdict adaptatif (déterministe + LLM d'appoint)
└── index.ts            analyzeContentIntegrity(pages, identity) -> rapport
```

### Near duplicate
1. Normalisation : texte principal, minuscules, retrait nav/footer/CTA récurrents
   (bloc présent sur > 60 % des pages = boilerplate, exclu).
2. Shingles de 5 mots -> SimHash 64 bits par page.
3. Pré-filtrage par bandes (LSH) pour éviter le O(n²) sur gros crawls.
4. Vérification exacte par Jaccard sur les paires candidates ; seuil de base 0,85.
5. Clustering transitif -> `clusters[]` avec page pivot (meilleur score SEO) et pages satellites.

### Thin content
Score 0-100 combinant : mots utiles hors boilerplate, ratio texte/HTML,
densité de titres, présence de contenu unique vs template, profondeur de crawl.
Seuil adaptatif par type de page (fiche produit, catégorie, article, page locale).

### Qualification (anti faux positifs)
- Couche déterministe (0 token) : tolérance ajustée par `market_sector` /
  `business_type` de la carte d'identité + template ratio du site.
- Couche LLM **uniquement sur clusters ambigus** (`google/gemini-3.1-flash-lite`
  via le routeur AI existant, avec repli Lovable AI) : verdict
  `cannibalization` | `watch` | `normal` + action recommandée.
- Budget : ~0,2 ¢ par crawl typique, plafonné à 5 appels par crawl.

## 3. Lots de livraison

**Lot 1 — Module partagé + intégration crawl**
- Créer `_shared/contentIntegrity/*`.
- Brancher dans `crawlQueue/finalizer.ts` (remplace `detectDuplicates` pour le
  volet contenu ; titre/meta dupliqués restent inchangés).
- Persister le rapport dans `site_crawls` (nouvelle colonne `content_integrity jsonb`)
  et enrichir `crawl_pages.issues` (`near_duplicate`, `thin_content`) + colonnes
  `near_duplicate_group`, `thin_score`.

**Lot 2 — Qualification adaptative**
- `qualify.ts` : seuils par secteur, template ratio, verdicts.
- Appel LLM d'appoint via le routeur existant, journalisé dans `ai_gateway_usage`.

**Lot 3 — UI crawl multi-page**
- Deux panneaux dans les résultats de crawl : « Contenus quasi-dupliqués » (clusters,
  badge de verdict violet/or/neutre) et « Contenus pauvres » (tri par score).
- Bouton « Envoyer au Workbench » -> alimente Parménion.
- Respect du design system : pas de fond de bouton, bordure + texte, pas d'emoji.

**Lot 4 — Marina**
- Après `preCrawlForAudit`, appeler `analyzeContentIntegrity` et pousser les
  constats via `marinaWorkbench.ts` (section `seo` -> `audit_tech`,
  catégorie `content_pruning`), source_record_id namespacé et idempotent.
- Nouvelle sous-section « Intégrité du contenu » dans le rapport Marina.

**Lot 5 — Consommation Parménion & Stratège**
- Parménion : les clusters `cannibalization` sont injectés comme thèmes saturés
  dans la phase `prescribe` (bloque les créations) et génèrent des tâches
  `fix_cannibalization` exécutées par `content-pruning-executor` ; les pages
  `thin_content` génèrent des tâches d'enrichissement plutôt que de suppression.
- Stratège Cocoon : le rapport devient une source du contexte
  (`crossAgentContext`), pour répondre aux questions type
  « vois-tu des contenus dupliqués ou trop pauvres ? ».

**Lot 6 — Vérifications**
- Tests unitaires SimHash/Jaccard/thin score (cas limites : pages template,
  pagination, filtres e-commerce).
- Dry-run sur `iktracker.fr` et `dictadevi.io`, contrôle des faux positifs.
- Mise à jour de la doc technique et de la doc SAV.

## 4. Détails techniques

- Aucune dépendance externe : SimHash et LSH en TypeScript pur (contrainte TS/Deno).
- Complexité maîtrisée : LSH par bandes, plafond de paires comparées, exécution
  dans le finalizer déjà asynchrone (pas de risque de timeout du crawl).
- Migration DB : colonnes ajoutées avec valeurs par défaut, GRANT conservés,
  RLS inchangée (isolation par `auth.uid()` via les tables existantes).
- Idempotence Workbench : `UNIQUE(source_type, source_record_id)` déjà en place.
- Coût LLM tracé dans `ai_gateway_usage` pour audit ultérieur.

## 5. Hors périmètre

- Cannibalisation sémantique (déjà gérée par Cocoon / `cannibalizationClusters.ts`).
- Détection de duplication cross-domaines (plagiat externe).
- Modification des règles de pruning existantes de Parménion.
