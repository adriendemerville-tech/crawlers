---
name: Structure narrative des rapports Marina
description: Intro pédagogique, chapeaux de section, conclusion priorisée et garde d'exigence du verdict dans les rapports Marina
type: feature
---
Tout rapport Marina suit une trame narrative imposée, générée côté backend (`supabase/functions/marina/index.ts`), 0 token LLM :

1. **Synthèse exécutive** (`buildExecutiveSummaryHTML`) — verdict global. Garde d'exigence : le verdict est rétrogradé d'un cran si ≥1 action `critical` dans le plan consolidé (`strong`→`ok`), de deux crans si ≥3 (`ok`→`weak`). Un site avec des blocages critiques ne peut plus être déclaré « solide ».
2. **Intro « Comment lire ce rapport »** (`buildReportIntroHTML`) — pages crawlées / connues, précision du périmètre, liste des sources externes réellement utilisées (crawler Crawlers, PageSpeed, DataForSEO, moteurs de réponse IA, index Google), points clés à retenir.
3. **Chapeaux de section** (`SECTION_LEADS` + `sectionLead(key, lang)`) — une phrase vulgarisée par section (`crawl`, `tech`, `strategic`, `cocoon`, `indexation`) : ce qui est mesuré, comment le lire, ce que ça ne dit pas.
4. **Conclusion et priorités** (`buildConclusionHTML`) — feuille de route 0-30 / 30-60 / 60-90 jours dérivée du plan consolidé.
5. **Divulgation méthodologique** puis **Portée et limites** (toujours en dernier).

Fusion multipages : `intro` est un bloc `data-marina-scope="site"` mutualisé, placé en tête de l'ordre des blocs site dans `src/lib/marina/mergeReports.ts`.

Export PDF (`src/utils/sectionBasedPdfExport.ts`) : tout bloc plus haut qu'une page A4 est éclaté en ses sous-blocs paginables (`.section`, `.toc`, `[data-marina-block]`…, profondeur max 3) avant capture, pour que la coupure tombe entre deux cadres et jamais au milieu. Chaque bloc est capturé à sa largeur réelle puis recentré dans la zone utile.
