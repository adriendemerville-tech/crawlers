---
name: Calibration du GEO par la citation réellement observée
description: Le score GEO des 10 sous-signaux est modulé de ±10 % par le taux de citation observé au benchmark LLM (neutre 20 %, borne haute 60 %, minimum 6 observations) ; le bandeau Marina affiche ce score déterministe, jamais la note LLM
type: feature
---

# Calibration du GEO par la citation réellement observée

`_shared/geoSubSignals.ts` reste le **juge unique** du score GEO /100. Les 10
sous-signaux mesurent un **potentiel** de citation ; le benchmark LLM mesure le
**résultat**. L'écart est corrigé par un facteur de calibration, pas par un 11e
sous-signal (la mesure est mutualisée au domaine et écraserait la variance par page).

- `GEO_CALIBRATION_MAX_PCT = 10` — modulation bornée à ±10 % du score final.
- `GEO_CALIBRATION_NEUTRAL_PCT = 20` — cible neutre (facteur 0).
- `GEO_CALIBRATION_HIGH_PCT = 60` — borne haute (+10 %).
- `GEO_CALIBRATION_MIN_OBSERVATIONS = 6` — sous ce seuil, aucune calibration :
  un échantillon trop court n'est pas une mesure.
- Le plafond `GEO_NO_AUTHORITY_CAP = 75` reste opposable **après** calibration.
- Une décote ≥ 5 % pousse un plafond `geo_citation` (catégorie `geo_visibility`
  dans `auditGates.ts`) : « signaux meilleurs que la citation réelle ».
- Le barème 25 / 22→17 / 53→58 n'est jamais modifié par la calibration.

Le détail est exposé dans `report.citation_calibration`
(`applied`, `rate_pct`, `observations`, `factor_pct`, `pre_score`, `post_score`, `note`).

## Marina
`extractObservedCitation()` lit `aggregate.coverage` (rate, observations) du
retour de `calculate-llm-visibility` et l'injecte dans `buildGeoSubSignals`.
Le bandeau de synthèse exécutive affiche **`pageGeo100`** (déterministe calibré) —
la note narrative de l'audit stratégique LLM ne sert plus que de repli si aucun
sous-signal n'est mesuré. Un paragraphe pédagogique rend la calibration explicite
dans le bandeau et dans le bloc « 10 sous-signaux, 3 piliers ».

## Explicitation dans le rapport
Le tableau des piliers affiche « Sous-total des signaux mesurés (potentiel) », une
ligne « Calibration par la citation observée » (taux, observations, facteur signé,
`pre → post`, mention « 0 % de citation = −10 % ») puis « Total GEO après
calibration ». Un encadré or énonce la règle complète (cible 20 %, pénalité linéaire
jusqu'à −10 % à 0 % de citation, bonus jusqu'à +10 % à 60 %, minimum 6 observations).
Le badge de l'audit stratégique est explicitement étiqueté « Score stratégique global »
avec la mention « ce n'est pas le score GEO » pour lever la confusion des deux notes.
