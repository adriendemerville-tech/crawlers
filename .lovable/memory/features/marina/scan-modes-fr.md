---
name: Marina scan modes
description: Trois modes de scan Marina (deep/standard/sample) avec bascule automatique selon les URLs découvertes
type: feature
---
## Modes de scan Marina — bascule automatique, jamais manuelle

Module : `supabase/functions/_shared/marinaScanMode.ts` (`resolveScanMode`, `scanModeSentence`).

| Mode | Déclenchement (URLs découvertes) | maxPages |
|---|---|---|
| `deep` | ≤ 120 | 120 |
| `standard` | 121 – 1000 (et fallback si volume inconnu) | 150 |
| `sample` | > 1000 | 60 (échantillon par gabarit) |

### Résolution du volume (gratuite)
1. `site_crawls.total_pages` du dernier crawl connu du domaine
2. sinon `crawl-site` en `mode: 'detect'` (aucun scraping, aucun crédit)
3. sinon `standard` par défaut

### Explicitation obligatoire
- Backend : l'introduction du rapport (`buildReportIntroHTML`) contient le mode retenu, la couverture visée en % et la grille des trois modes.
- Frontend : `src/components/Marina/MarinaScanModePanel.tsx` sous la barre d'URL de `/marina` — informatif, aucun réglage manuel exposé.

Motif : au-delà de 1000 URLs un crawl intégral ne tient pas dans le wall-time d'un run (échec constaté sur avenir-renovations.fr, ~7000 URLs).
