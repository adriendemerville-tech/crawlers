# Matrice Concurrence — documentation technique

Outil gratuit public (`/matrice-concurrence`) + module Concurrence de la console
(`/app/console`, onglet Concurrence). Produit une matrice à double entrée
(concurrents × 20 mots-clés du marché), puis un rapport hiérarchisé exportable.

Règle produit non négociable : **aucune donnée n'est inventée**. Une case non
relevée porte l'état `not_measured`, jamais `absent`.

## Arborescence

| Fichier | Rôle |
| --- | --- |
| `src/lib/competitorMatrix/types.ts` | Types partagés, libellés FR, constantes (`MATRIX_KEYWORDS=20`, `SEED_SERP_KEYWORDS=10`, `LEADER_MIN_HITS=3`, `AI_MEASURED_KEYWORDS=10`, `AI_ITERATIONS=3`, `LOCATION_FR=2250`) |
| `matrix.functions.ts` | Server functions publiques : quota, start, `advanceCompetitorMatrix` (machine à états), lead, lecture par `shareToken` |
| `console.functions.ts` | Server functions console : liste/rattachement, start, get, delete par `user_id` |
| `identity.server.ts` | `resolveIdentity()` — carte d'identité (nom, activité, localité) avant tout relevé, comme dans Marina |
| `keywords.server.ts` | Pool d'amorçage, `generateAiQueries()`, `expandMarketKeywords()` (DataForSEO + LLM) |
| `serp.server.ts` | `seedSerp()` (découverte du marché) et `readSerp()` (positions + AI Overviews) |
| `leaders.server.ts` | `detectLeaders()` par pondération d'occurrences top 5 / AI Overview, `detectQuickWins()` |
| `competitors.server.ts` | Consolidation leaders + concurrents métier/visibilité, typage `CompetitorType` |
| `aiCitations.server.ts` | `measureKeywordForModel()` — un appel serveur = 1 moteur × 3 itérations (Gemini, ChatGPT, Claude) |
| `build.ts` | `cellState()` / `buildMatrix()` — assemblage des lignes, résumé, hors-périmètre |
| `report.ts` | Verdict, KPIs, `buildCoverageGaps()` (indice de rentabilité détaillé), plan d'action |
| `reportHtml.ts` / `reportCopy.ts` | Rendu HTML paginé pour export PDF et textes pédagogiques |

Front : `src/pages/MatriceConcurrence.tsx` (outil public, FAQ, capture de lead),
`src/components/.../MatrixReportView.tsx` (rapport structuré),
`src/components/Profile/CompetitionTab.tsx` (module console, polling, historique).

## Machine à états

`pending → identity → seed_keywords → seed_serp → competitors → keywords → serp → ai → done`

Chaque étape est **atomique** et persistée dans `competitor_matrix_jobs` : le
client appelle `advanceCompetitorMatrix` en boucle avec retry/backoff. Ce
découpage évite les timeouts du worker ; l'étape `ai` accumule les observations
moteur par moteur (`hits`, `observations`, `modelsDone`).

## Données

- `competitor_matrix_jobs` — état complet du job (identité, concurrents, mots-clés, matrice, `share_token`, `user_id` nullable).
- `competitor_matrix_leads` — emails de capture de l'outil public.

Rattachement : `listConsoleMatrices` réassigne au compte les jobs anonymes du
domaine quand l'utilisateur le possède dans `tracked_sites`.

## Quotas

`MATRIX_FREE_QUOTA = 1` matrice par IP et par jour pour l'anonyme. Les
administrateurs (`isAdminRequest()`) sont exemptés — l'UI affiche
« Usage illimité (admin) ».

## Rapport

Verdict global, KPIs, gaps de couverture classés par indice de rentabilité
(volume × proximité du top 10 ÷ difficulté, détail par facteur affiché et
exporté), quick wins (cible en 11-30 alors qu'un leader occupe le top 5), puis
plan d'action priorisé. Le rapport reste **consultatif** : seules les
recommandations explicites peuvent alimenter le workbench (`source_type:
'strategic'`), jamais le rapport intégral.
