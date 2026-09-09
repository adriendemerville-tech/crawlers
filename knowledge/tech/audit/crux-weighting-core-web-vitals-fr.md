# Pondération des Core Web Vitals par CrUX

Dernière mise à jour : 2026-09-09

Module partagé : `supabase/functions/_shared/cruxWeighting.ts`.

## Rôle

CrUX n'est **pas** une source principale (pas de mot-clé, pas de trafic, p75 sur
28 jours, seuil de popularité). Il ne remplace donc jamais la mesure laboratoire
(PageSpeed/Lighthouse) : il la **pondère**, à la hausse quand le vécu réel est
bon, à la baisse quand il est mauvais.

## Règles de calcul

- Bandes : LCP good ≤ 2 500 ms / poor > 4 000 ms ; INP good ≤ 200 ms / poor
  > 500 ms ; CLS good ≤ 0,1 / poor > 0,25.
- `fieldRatio` normalisé de −1 (tout « poor ») à +1 (tout « good »), le LCP
  pesant davantage.
- Aucune donnée de terrain → multiplicateur neutre `1,0`. On n'invente jamais
  une pondération.
- Terrain sur l'**URL** → effet plein ; terrain sur l'**origine** seulement →
  effet amorti à 60 %.
- Bornes : bonus max **+12 %**, malus max **−18 %** (multiplicateur 0,82 → 1,12).
- `contradictsLab` signale une divergence labo/terrain, utilisée comme gate.

## Consommateurs

- `audit-expert-seo/index.ts` : applique la pondération **après** le calcul
  laboratoire, borne le score performance entre 8 et 40, pose une gate en cas de
  dégradation terrain, expose `scores.performance.cruxWeighting`.
- `marina/index.ts` : affiche `cruxWeightingBlockHTML()` dans le rapport, y
  compris pour dire explicitement qu'aucune donnée CrUX n'est disponible.

Le module expose aussi la note explicative multilingue prête à afficher, pour
que le rapport ne laisse jamais une pondération sans justification.
