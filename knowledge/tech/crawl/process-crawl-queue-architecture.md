# Memory: tech/crawl/process-crawl-queue-architecture
Updated: 2026-04-13

## process-crawl-queue — Architecture modulaire (Phase 5)

### Décomposition
Le monolithe `process-crawl-queue/index.ts` (1366→230 lignes) a été refactorisé en 5 modules dans `_shared/crawlQueue/` :

| Module | Responsabilité | Lignes |
|--------|---------------|--------|
| `types.ts` | Interfaces `PageAnalysis`, `CustomSelector`, `AnchorText` | ~55 |
| `htmlAnalyzer.ts` | `analyzeHtml()`, `computePageScore()`, `validateSchemaOrg()`, `extractCustomSelectors()`, `detectSPAMarkers()`, `simpleHash()` | ~300 |
| `scraperStrategy.ts` | `scrapePage()` (cascade renderPage→Spider→Firecrawl), `probeSPAStatus()`, `renderWithBrowserless()` | ~200 |
| `duplicateDetector.ts` | `detectDuplicates()` (titre+meta+hash), `computeBFSDepths()`, `computeDepth()` | ~120 |
| `finalizer.ts` | `finalizeJob()`, `generateAISummary()`, `feedKeywordUniverse()`, `triggerVoiceToneAnalysis()` | ~300 |

### Pipeline de scraping (Strategy Pattern)
1. **renderPage** (interne, gratuit) — fetch + détection SPA
2. **Spider.cloud** (primaire payant) — rendu JS léger
3. **Firecrawl** (fallback payant) — scrape complet avec waitFor
4. **Browserless** (SPA uniquement) — headless Chrome si SPA détectée via probe

### Flux du worker
1. Récupère les jobs `pending`/`processing` (max 10)
2. Checkpoint reconciliation depuis `crawl_pages` (reprise après crash)
3. SPA probe sur la 1re page → active Browserless si nécessaire
4. Boucle interne avec batch dynamique (1-4 pages selon poids HTML)
5. Pass 2 : découverte de liens internes (+200 URLs max)
6. Finalisation : BFS depths, duplicates, AI summary (Gemini Flash), keyword_universe, voice tone trigger
