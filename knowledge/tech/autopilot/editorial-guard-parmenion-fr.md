# Memory: tech/autopilot/editorial-guard-parmenion-fr
Updated: 2026-04-13

## Garde-fou éditorial — Parménion × IKtracker

### Règles

1. **Contenu créé par Parménion** → modification INTERDITE (auteur contient "parménion", "parmenion" ou "crawlers autopilot")
2. **Contenu créé par un autre auteur** → modification autorisée SAUF si publié depuis ≥ 6 mois

### Implémentation

Le garde-fou `checkEditorialGuard()` est implémenté dans `supabase/functions/iktracker-actions/index.ts`. Il s'applique à :

- `update-post` (appel direct)
- `update-page` (appel direct)
- Upserts automatiques dans `create-post` (exact slug match, jaccard, core_topic, slug dedup)

### Comportement

- Si bloqué → retour HTTP 403 avec `_editorial_guard: true` et raison humaine
- Log `[iktracker-actions] EDITORIAL GUARD BLOCKED` pour traçabilité

### Fichiers modifiés
- `supabase/functions/iktracker-actions/index.ts`
