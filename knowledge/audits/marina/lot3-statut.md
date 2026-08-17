# Lot 3 — Boilerplate retiré avant analyse : statut (2026-08-17)

## Brique partagée

`supabase/functions/_shared/contentIntegrity/normalize.ts` expose désormais :

| Export | Rôle |
|---|---|
| `splitSegmentsRaw` | découpe en segments en conservant le texte d'origine |
| `looksLikeNavigation` | heuristique mono-page (aucune ponctuation de phrase, libellés capitalisés, séparateurs `•|·`) |
| `buildBoilerplateSet` | segments présents sur > 60 % des pages d'un corpus (≥ 5 pages) |
| `stripBoilerplate` | retire gabarit corpus + segments de navigation, ne renvoie jamais du vide |

100 % déterministe, 0 token LLM.

## Consommateurs câblés

| Fichier | Correction |
|---|---|
| `_shared/aeoRewrites.ts` | `buildAeoRewrite(page, boilerplate?)` ; `buildAeoRewrites` calcule le set de gabarit du corpus → fin du faux « premier paragraphe de 727 mots » (méga-menu) |
| `audit-strategique-ia/index.ts` | paragraphe d'ouverture (résilience de résumé, réponse directe) extrait du texte utile |
| `audit-expert-seo/index.ts` | suppression DOM de `nav/header/footer/aside/[role=navigation|banner|contentinfo]` + filet `stripBoilerplate` avant word count, ratio texte/code et thin content |
| `calculate-cocoon-logic/index.ts` | `body_text_truncated` nettoyé du gabarit avant TF-IDF → la similarité et les clusters ne sont plus portés par le menu |

## Effets attendus

- Plus de prescription AEO visant un menu ; les paragraphes cités dans le Workbench sont du vrai contenu.
- Ratio texte/code et thin content mesurés sur le contenu utile (moins de faux « optimal » sur pages vitrine à gros menu).
- Cannibalisation / near-duplicate Cocoon moins bruités par le boilerplate.

## Reste du plan

Lot 4 (réconciliation des compteurs, clamp des scores), Lot 5 (déduplication + ROI), Lot 6 (éditorialisation), puis re-notation avec la grille consolidée.
