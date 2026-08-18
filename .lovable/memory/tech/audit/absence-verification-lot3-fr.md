---
name: Lot 3 — contre-vérification des absences
description: Aucune absence de H1/JSON-LD/meta description n'est affirmée sans re-test en rendu complet ; sitemap découvert via robots.txt
type: feature
---

# Lot 3 — contre-vérification des absences (`_shared/absenceVerification.ts`)

## Règle

Une absence de balise mesurée sur le HTML servi n'est **jamais** restituée comme
un manque éditorial sans re-test en rendu complet (JavaScript exécuté).

- 3 pages au plus sont re-rendues par crawl (accueil d'abord, puis les pages
  cumulant le plus d'absences / les plus profondes). Coût borné, 0 token LLM.
- Les pages déjà marquées coquille JS (`SHELL_ISSUE_MARKER`) sont exclues :
  leur cause racine est traitée par `botRenderingShell.ts`.
- Un rendu qui n'a pas réellement eu lieu (`usedRendering === false`) ne compte
  pas comme contre-vérification.

## Verdicts

| Verdict | Sens | Provenance |
|---|---|---|
| `absent_partout` | absent du HTML servi ET du HTML rendu | Mesuré |
| `absent_pour_les_bots` | présent après rendu JS uniquement | Testé |

Dès qu'une seule page révèle la balise après rendu, le signal passe en
`bot_only_signals` pour tout le site : le correctif est le rendu serveur, pas la
rédaction.

## Restitution Marina

- `absenceReliabilityBlockHTML` : encart « Fiabilité des constats de contenu »
  en tête de la section crawl (nombre de pages re-testées, moteur de rendu,
  signaux absents partout vs absents pour les robots).
- `isBotOnlyAbsence` filtre les constats démentis par le rendu, y compris quand
  le verdict racine de rendu n'est pas déclenché.
- `absenceVerificationFinding` : constat critique « balises émises seulement
  après rendu », ajouté uniquement si le constat racine `bot_rendering_shell`
  n'est pas déjà présent (pas de doublon).
- Persistance : `site_crawls.content_integrity.absence_verification`.

## Sitemap

`_shared/sitemapUrls.ts` lit d'abord toutes les directives `Sitemap:` du
`robots.txt` (résolues en URL absolues), puis les chemins usuels
(`/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-index.xml`, `/wp-sitemap.xml`,
`/sitemap-0.xml`). Ne jamais conclure « aucun sitemap » sans cette lecture.
