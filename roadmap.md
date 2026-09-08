# Roadmap — Renommage Parmenion (autopilot) → Périclès

- [x] Migration DB : tables pericles_* (copie + backfill), enum, 9 RPC pericles_*, triggers, RLS, grants (migration 0014, additive — anciens objets conservés)
- [x] Renommage front/src : composants Admin Pericles*, src/lib/pericles, periclesPdfReport, SDK @pericles/sdk, docs/routes, textes marketing (Périclès)
- [x] Edge functions (identifiants DB + RPC) : pericles-api (slug parmenion-api conservé, tables/RPC migrés), parmenion-feedback, supervisor-actions, autopilot-engine (tables), crawlers-api, cron-crawl-scheduler, cms-register-api-key, admin-backend-query, copilot registry, dictadevi/iktracker/content-pruning/cocoon-strategist/workbench-hygiene, _shared/pericles*
- [ ] Reste edge : parmenion-orchestrator (131 occ., lit/écrit encore parmenion_*), sav-agent (52 occ.), _shared/techDocIndex (docs internes)
- [ ] Données : UPDATE cms_connections SET managed_by='pericles' WHERE managed_by='parmenion' (code déjà bi-compatible)
- [ ] Build + redéploiement des fonctions modifiées
- [x] Offre Parmenion 59 € intacte (passe_orders/passe_passes, parmenion_pass, ParmenionLanding, ParmenionCta, passe-visibilite)

Note : les anciennes tables parmenion_* existent toujours → l'orchestrateur non migré continue de fonctionner sans panne, mais écrit dans les anciennes tables jusqu'à sa migration.
