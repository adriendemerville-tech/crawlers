# Memory: tech/strategic-audit/engine-v5-fr
Updated: 2026-04-13

L'Audit Stratégique GEO (v5) intègre une analyse profonde de la SERP et de l'audience :

1. **Lacunes sémantiques** : Identification des termes clés manquants (missing_terms) et calcul de la densité sémantique comparative.
2. **Recommandations** : Actions concrètes pour progresser dans les classements.
3. **Stratégie alternative** : Suggestion optionnelle (RP, partenariats, vidéo, événement) pour les sites en position très défavorable (>50), précisant le 'quoi/comment/combien' et rappelant l'impact des actions offsite sur le ranking.
4. **Classification concurrentielle** : Système à 4 niveaux (Goliath, Direct, Challenger, Inspiration) basé sur la similarité identitaire (entreprise/produit) et la position SERP.
5. **Analyse des Cibles Clients** : Détection des segments prioritaires, secondaires et inexploités (B2B/B2C). Persisté dans `tracked_sites.client_targets`.
6. **Empreinte Lexicale v2 — Distance sémantique relative** : Score d'intentionnalité hybride (4 composantes), labels contextuels, persisté dans `tracked_sites.jargon_distance`.
7. **Audio** : Le lecteur Spotify inclut des boutons de navigation 'Précédent' et 'Suivant'.
8. **Pré-Crawl intelligent** (v5.2) : Vérifie crawl récent < 7 jours, sinon crawl intermédiaire des 10 pages top. Helper : `_shared/preCrawlForAudit.ts`.

## Architecture modulaire (Phase 6 — 2026-04-13)

Le monolithe `audit-strategique-ia/index.ts` (3 498 lignes) a été refactoré en **9 modules spécialisés** dans `_shared/strategicAudit/` + un orchestrateur de ~580 lignes.

| Module | Lignes | Responsabilité |
|--------|--------|----------------|
| `types.ts` | 136 | Interfaces partagées : `ToolsData`, `EEATSignals`, `MarketData`, `RankingOverview`, `BrandSignal`, `FounderInfo`, `GMBData`, `CtaSeoSignals`, `PageType` |
| `textUtils.ts` | 49 | `STOP_WORDS`, `cleanAndTokenize`, extraction métadonnées |
| `brandDetection.ts` | 109 | `resolveBrandName` (signaux pondérés), `humanizeBrandName`, `sanitizeBrandNameInResponse` |
| `businessContext.ts` | 178 | `detectBusinessContext`, `KNOWN_LOCATIONS`, `generateSeedsWithAI` |
| `dataForSeo.ts` | 337 | `fetchMarketData`, `fetchRankedKeywords`, tri stratégique, appels DataForSEO |
| `socialDiscovery.ts` | 303 | `detectGoogleMyBusiness`, `searchFounderProfile`, `searchFacebookPage`, `findLocalCompetitor` |
| `pageAnalyzer.ts` | 224 | Fetch HTML/SPA, extraction E-E-A-T, signaux CTA/SEO, brand signals |
| `prompts.ts` | 330 | Prompts LLM par `PageType` (homepage/editorial/product/deep), `buildUserPrompt` |
| `registrySaver.ts` | 166 | `saveStrategicRecommendationsToRegistry`, `saveToCache`, `feedKeywordUniverse`, `persistIdentityData` |
| **Total modules** | **1 832** | |
| `index.ts` (orchestrateur) | 579 | HTTP routing, async jobs, parallélisation Wave 1/Wave 2, appels LLM, post-processing |

### Imports de l'orchestrateur
L'`index.ts` importe depuis `_shared/strategicAudit/*` et orchestre :
- **Wave 1** (parallèle) : `extractPageMetadata` + `fetchRankedKeywords`
- **Wave 2** (parallèle) : `fetchMarketData` + LLM visibility + `detectGoogleMyBusiness` + `searchFounderProfile` + `searchFacebookPage`
- **Post-processing** : `sanitizeBrandNameInResponse`, validation self-ref concurrents, `jargon_distance` via LLM séparé

## Corrections rapport PDF (v5.1)
- Fix `undefined`, ratios jargon capés, méthodologie du scoring, AEO détaillé.

## Diagnostic d'hallucinations (v5.2)
La fonction `diagnose-hallucination` charge toutes les données factuelles (crawl, audit, ranking, identity card, corrections précédentes). 4 verdicts : `misleading_data`, `absent_data`, `training_bias`, `reasoning_error`.

## Tables impactées
- `tracked_sites.client_targets` (jsonb)
- `tracked_sites.jargon_distance` (jsonb)
- `tracked_sites.identity_card` (jsonb)

## Types front-end
- `JargonTargetScore`, `JargonIntentionality`, `JargonDistance`, `LexicalFootprint`
