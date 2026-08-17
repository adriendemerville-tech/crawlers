---
name: Éditorialisation du rendu des rapports (Lot 6)
description: Traduction des champs bruts, badges de sévérité, suppression des tableaux de remplissage et nommage des clusters dans les rapports Marina
type: feature
---
Module partagé `supabase/functions/_shared/reportEditorial.ts` (0 token LLM), consommé par `marina/index.ts` :

- `humanizeKey` / `humanizeValue` : tables de traduction FR des clés (`readiness_level`, `toxicity_score`, `missing_terms`, `red_team`, `current_rank`…) et des valeurs énumérées (`developing`, `low/medium/high`, `know/do/buy/navigate`, booléens). Aucun `snake_case` ni terme anglais ne doit atteindre le livrable.
- `splitTrailingSeverity` + `severityBadgeHTML` : une sévérité collée en fin de phrase (« … — Critique ») est détachée et rendue en badge coloré, jamais concaténée.
- `isFillerTable` : un tableau d'objets dont toutes les valeurs numériques valent 0 n'est pas rendu.
- `clusterDisplayName` / `consolidateClusters` / `isolatedClustersNoteHTML` : les clusters sont nommés par leur terme dominant (« Thématique « rénovation, toiture » ») au lieu de `cluster_23`, et les clusters à une seule page sont regroupés en une ligne « n thématiques isolées ».

Titres de modules renommés : GEO Readiness → Maturité GEO ; Quotabilité → Citabilité : extraits reprenables ; Red Team (Adversarial) → Test adversarial.
