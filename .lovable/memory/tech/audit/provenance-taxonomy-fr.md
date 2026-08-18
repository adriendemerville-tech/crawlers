---
name: Taxonomie de provenance des chiffres
description: Tout chiffre de rapport porte un statut Mesuré / Testé / Déduit / Estimé via _shared/provenance.ts
type: feature
---

# Taxonomie de provenance (`_shared/provenance.ts`)

Tout chiffre restitué dans un rapport Crawlers relève de **un seul** de ces
quatre niveaux, et porte la pastille correspondante :

| Niveau | Sens | Couleur |
|---|---|---|
| `mesure` — Mesuré | relevé direct sur le site ou une API, reproductible | noir `#111827` |
| `test` — Testé | interrogation réelle d'un moteur IA, non déterministe | violet `#6d28d9` |
| `deduction` — Déduit | calcul par règles fixes sur des faits mesurés | or `#8a6d1f` |
| `estimation` — Estimé | ordre de grandeur pondéré, non garanti | gris `#6b7280` |

Charte respectée : pastilles bordure + texte, jamais de fond plein, aucun bleu,
aucun emoji.

## Règles

- `METRIC_PROVENANCE` est la **source unique de vérité** : ne jamais réattribuer
  un niveau au cas par cas dans une section. Un nouvel indicateur s'ajoute à la
  table, pas en dur dans le HTML.
- Un chiffre `estimation` (gain de trafic, ROI, jours-homme) ne doit jamais être
  présenté avec la même autorité visuelle qu'un chiffre `mesure`.
- Les scores SEO / GEO / global / autorité / E-E-A-T sont **`deduction`**, jamais
  « mesurés » : ne plus écrire « les scores sont mesurés, pas estimés ».
- La visibilité LLM et les questions de benchmark sont **`test`** : la question
  est tracée, la réponse n'est pas reproductible.
- `provenanceLegendHTML()` est appelé **une seule fois** par rapport, dans la
  section « Comment lire ce rapport ».
