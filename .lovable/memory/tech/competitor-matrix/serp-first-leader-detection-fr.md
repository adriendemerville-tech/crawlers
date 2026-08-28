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

## Contraintes DataForSEO (relevés SERP)

- Les endpoints `live` n'acceptent **qu'une seule tâche par requête** ; un batch renvoie `40000 You can set only one task at a time` et donc zéro leader. `serp.server.ts` envoie une requête par mot-clé, en lots parallèles de 5.
- `people_also_ask_click_depth` est **invalide** sur `serp/google/organic/live/advanced` (`40501`). Ne pas le renvoyer.
- Requêtes d'amorçage : les formulations courtes (≤ 60 car.) passent d'abord ; une question conversationnelle longue ne produit pas de SERP marché exploitable.
- `cleanDomain()` regroupe les sous-domaines de localisation (`fr.semrush.com` → `semrush.com`), sinon les occurrences se dispersent et aucun acteur n'atteint `LEADER_MIN_HITS`.
- Quotas de lignes : leader 3, métier 2, visibilité 2, silencieux 1.
