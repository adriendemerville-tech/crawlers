---
name: Parménion Targeting Lenses
description: Lentilles de ciblage (localisation/persona/cluster) — bonus de score max +8 sur les items de création et quota de slots contenu selon share_pct (plafond 50%)
type: feature
---

## Lentilles de ciblage Parménion

Table `parmenion_targeting_lenses` (une ligne par `target_id` × `lens_type`), UI dans `ParmenionTargetPanel` → `ParmenionTargetingLenses.tsx`, options déterministes via `src/lib/parmenion/lensOptions.server.ts` (aucun LLM).

### Sprint 2 — scoring et slots
- `score_spiral_priority` retourne deux colonnes de plus : `lens_bonus` (numeric) et `lens_applied` (jsonb).
- Bonus appliqué **uniquement** aux items de création (`missing_page`, `content_gap`, `missing_content`, `competitive_gap`) et aux lentilles `proof_level` in ('weak','strong') : cluster +8, persona +6, localisation +6, **plafonné à +8**.
- Le cap de diversité thématique (2 items par cluster) reste prioritaire : le bonus ne le contourne jamais.
- `parmenion-orchestrator` : `share_pct` (max des lentilles actives, plafond 50) sous-divise **les slots contenu seulement** → `orientedSlots = floor(contentSlots * share/100)`. Si aucun item orienté n'est éligible, les slots retournent au pool général — jamais de création forcée.
- Log par cycle : `[Parménion] 🔎 Lentilles: ... | share X% → N slot(s) réservé(s), M consommé(s)`.

### Non négociable
- Aucune lentille n'agit sur les pages existantes, ni sur le pruning/merge.
- Une lentille sans preuve mesurée est ignorée par le moteur.
