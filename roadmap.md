# Roadmap — Renommage Parmenion (autopilot) → Périclès

- [ ] Migration DB : tables pericles_targets / pericles_decision_log / pericles_targeting_lenses (copie + backfill), enum, 9 RPC pericles_*, triggers, RLS, grants, index partiel cms_connections
- [ ] Renommage code : edge functions parmenion-* → pericles-*, _shared/parmenion → _shared/pericles, composants Admin Parmenion* → Pericles*, SDK, docs, routes études
- [ ] Données : cms_connections.managed_by, clés config parmenion_active/parmenion_mirror
- [ ] Build + déploiement edge functions renommées
- [ ] Ne PAS toucher : offre Parmenion 59 € (passe_orders/passe_passes, parmenion_pass, ParmenionLanding, ParmenionCta, passe-visibilite)
