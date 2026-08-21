---
name: Mode démo console — données fictives front
description: Interrupteur Administration (system_config.demo_mode) + fixtures front-only pour GSC BQ, SEA→SEO, GMB, Indexation, Logs bots
type: feature
---

# Mode démo de la Console

- Activation : interrupteur `DemoModeToggle` dans Administration → `system_config.key = 'demo_mode'`, valeur `{ active: boolean }`, propagée en realtime par `DemoModeProvider` (`src/contexts/DemoModeContext.tsx`).
- En mode démo : suppression des erreurs front (toast/console/onerror), retry auto des invocations, ET injection de données fictives.
- Fixtures **front uniquement**, aucune écriture en base : `src/lib/demo/consoleDemoData.ts` (valeurs déterministes, pas de Math.random au niveau module pour éviter les écarts SSR).
- Modules couverts (ceux sans données réelles sur le compte admin) :
  - GSC BigQuery : `GscBigQueryExplorer` (résultats par `kind`, exécution auto) + `GscBigQueryPanel` (site fictif si aucun site tracké)
  - Indexation : `IndexationMonitor` (checks fictifs, aucun appel `check-indexation`)
  - Logs / bots : `src/pages/BotActivity.tsx` + `ReliabilityWidget`
  - SEA→SEO : déjà géré dans `SeaSeoBridge` / `SeaSeoBridgeTab`
  - GMB : `GMBDashboard` via `simulatedDataEnabled || isDemoMode`
- Règle : ne jamais insérer de données de démo en base ni sur un site réel ; toute extension du mode démo passe par une fixture dans `consoleDemoData.ts`.
