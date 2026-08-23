# GEO 3 piliers à pondération décroissante dans le temps

## Objectif

Remplacer le modèle GEO actuel (2 familles figées : Compréhension 50 / Autorité 50)
par un modèle **3 piliers** dont les poids évoluent avec le temps, pour refléter la
maturité du marché GEO :

- Aujourd'hui l'**accessibilité machine** est un différenciateur fort (beaucoup de
  sites concurrents pas crawlables ou trop lents) → elle pèse lourd.
- Ce n'est qu'un avantage **transitoire** : il se commoditise à mesure que le parc
  de sites se rénove → son poids **décroît** vers un plancher.
- L'**exploitabilité du contenu** est le levier durable → son poids **monte**.
- L'**autorité domaine** reste constante.

Le score total reste **sur 100 à chaque instant** (la somme vaut toujours 100).

## Modèle de pondération

Paramètre validé : **demi-vie 18 mois** (décroissance modérée).

```
Autorité domaine : 25                          (constant)
Accessibilité    : 10 + 15 × 0,5^(t / 18)      (t en mois depuis 2026-08)
Contenu          : 100 − 25 − accessibilité    (ce qui reste)
```

| t (mois) | Autorité | Accessibilité | Contenu |
|----------|---------:|--------------:|--------:|
| 0        | 25       | 25            | 50      |
| 18       | 25       | 17,5          | 57,5    |
| 36       | 25       | 14            | 61      |
| 72       | 25       | 11            | 64      |
| →∞       | 25       | 10            | 65      |

`t = mois écoulés depuis 2026-08-01`. Les poids sont donc **déterministes** :
deux audits du même jour donnent les mêmes poids.

## Remappage des 10 sous-signaux en 3 piliers

Les poids relatifs internes à chaque pilier restent fixes ; le poids en points de
chaque sous-signal est mis à l'échelle pour que le pilier totalise son poids
courant (`poids_point = poids_pilier × rel_i / Σ rel`).

**Pilier A — Autorité domaine (25, constant, mutualisé)**
- `brand_authority` (14)
- `serp_presence` (11)

**Pilier B — Accessibilité machine (25 → 10, décroissant)**
- `bot_accessibility` (14)
- `structured_data_quality` (12)
- `content_freshness` (6)

**Pilier C — Exploitabilité contenu (50 → 65, croissant)**
- `content_quotability` (10)
- `answer_formatting` (8)
- `knowledge_graph_signals` (10)
- `self_citation_signals` (8)
- `person_authority` (6)

Note : `knowledge_graph_signals` est déplacé de l'autorité vers l'exploitabilité
car son levier (alignement identité sur la page) est actionnable côté contenu.
Ajustable sur retour.

## Implementation

### 1. `supabase/functions/_shared/geoSubSignals.ts`
- Ajouter `GEO_PILLAR_WEIGHTS(now)` : fonction déterministe qui retourne
  `{ authority, accessibility, content }` et les poids en points des 10
  sous-signaux à la date de l'audit.
- Restructurer le rapport : `GeoFamilyScore` passe de 2 familles à 3 piliers
  (`authority`, `accessibility`, `content`), chaque pilier garde `score`,
  `coverage`, `measured`, `total`.
- `geo_score` = moyenne pondérée des piliers mesurés (exclusion numérateur ET
  dénominateur des signaux non mesurés, comme aujourd'hui).
- Exposer `pillar_points` : les poids en points affichés à la date de l'audit,
  + `trend` par pilier (constant / décroît / monte) pour le rendu.
- Afficher le `geo_score` sur 100 comme aujourd'hui.

### 2. `src/lib/marina/*` (fiches page du rapport multipage)
- Afficher le GEO en 3 piliers par fiche : « Autorité domaine », « Accessibilité
  machine », « Exploitabilité contenu », chacun sur son nombre de points courant.
- Restaurer la variance entre pages : l'autorité domaine (25, mutualisée) est
  identique sur toutes les fiches, mais accessibilité + contenu (75 pts) varient
  réellement par page.

### 3. Rendu HTML (`geoSubSignalsBlockHTML` + `marinaPageVerdict`)
- Afficher les poids en points du jour et la tendance (`→ décroît vers 10`,
  `→ monte vers 65`) pour rendre la temporalité lisible.

### 4. Témoin temporel
- Le rapport affiche la date de référence des poids (ex. « pondération au
  2026-08 ») pour que deux PDF d'époques différentes ne soient pas comparés à
  égalité sans le savoir.

## Périmètre

Fichiers touchés : `supabase/functions/_shared/geoSubSignals.ts` (cœur),
`supabase/functions/marina/index.ts` (fiches + bloc stratégique),
`supabase/functions/_shared/marinaPageVerdict.ts`,
`supabase/functions/strategic-synthesis` (si besoin de géo_score),
`audit-strategique-ia` (consommateur), et le rendu PDF.

Hors périmètre : pas de changement des sous-signaux mesurés ni de leur logique de
score — seule leur **pondération** et leur **regroupement** changent.

## Vérification

- Unit test sur `GEO_PILLAR_WEIGHTS` : somme des 3 piliers = 100 à plusieurs
  dates ; décroissance strictement décroissante de l'accessibilité ; plancher 10.
- Régénération d'un rapport multipage : 3 piliers par fiche, variance visible sur
  accessibilité + contenu, géo_score total sur 100.
