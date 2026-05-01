---
name: tech/autopilot/auto-config-on-target-fr
description: Trigger DB qui crée automatiquement une autopilot_configs (dry_run, idle, toutes phases activées) à chaque insertion/activation dans parmenion_targets, mappé sur le tracked_sites le plus récent du domaine.
type: feature
---

# Auto-création de config autopilote pour nouvelle cible Parménion

Trigger `trg_auto_create_autopilot_config` sur `parmenion_targets` (AFTER INSERT OR UPDATE OF is_active, autopilot_enabled, domain) → fonction SECURITY DEFINER `auto_create_autopilot_config_for_target()` :

- Skip si `is_active=false` ou `autopilot_enabled=false`
- Cherche le `tracked_sites` le plus récent (`ORDER BY created_at DESC LIMIT 1`) avec le même `domain`
- Skip si une `autopilot_configs` existe déjà pour ce `tracked_site_id`
- Insert config par défaut : `is_active=true`, `status='idle'`, toutes phases diag/presc à `true`, `implementation_mode='dry_run'`, `max_pages_per_cycle=10`, `cooldown_hours=48`, `content_budget_pct=30`, `use_editorial_pipeline=true`

**But** : éviter le cas crawlers.fr où la cible Parménion existait depuis avril mais sans config autopilote → 0 cycle exécuté. Désormais, ajouter un site dans Parménion suffit pour qu'il commence à tourner (en dry_run le temps que l'utilisateur valide).
