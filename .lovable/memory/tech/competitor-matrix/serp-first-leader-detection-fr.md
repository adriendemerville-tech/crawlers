---
name: Matrice concurrence — leaders lus dans la SERP
description: Séquencement en deux passes SERP, type `leader`, requalification des goliaths et quick wins de la Matrice de concurrence
type: feature
---

# Matrice de concurrence — les leaders sont mesurés, pas devinés

## Séquencement (deux passes SERP)

`identity` → `seed_keywords` → `seed_serp` → `competitors` → `keywords` → `serp` → `ai`

La liste des concurrents est arrêtée APRÈS la passe 1. Ne jamais revenir à un
ordre où les concurrents sont figés avant tout relevé SERP : aucun leader des
positions 1-5 ne pourrait entrer dans la matrice.

- `seed_keywords` : `buildSeedKeywordPool()` = ranked_keywords de la cible + requêtes IA (60 max).
- `seed_serp` : `seedSerp()` sur 10 requêtes, profondeur 30, lit TOUS les domaines du top 10 + AI Overview.
- `keywords` : `expandMarketKeywords()` réutilise le pool d'amorçage (pas de second appel DataForSEO cible) et ajoute le gap des leaders.

## Taxonomie

- Type `leader` (source `serp`) : top 5 sur ≥ 3 requêtes d'amorçage, ou cité par l'AI Overview sur ≥ 3 requêtes (`LEADER_MIN_HITS`).
- Un `goliath` proposé par le LLM et présent dans la SERP d'amorçage est requalifié en `leader` et entre dans la matrice. `outOfScope` ne garde que les substituts et les goliaths non confirmés.
- Quotas de lignes : 2 leaders, 3 métier, 2 visibilité, 1 silencieux (8 max).

## Quick wins

Cible en 11-30 alors qu'un leader occupe le top 5 → `quickWin: true`, valeur × 1,8, colonne mise en avant. Une cible non mesurée n'est jamais un quick win.
