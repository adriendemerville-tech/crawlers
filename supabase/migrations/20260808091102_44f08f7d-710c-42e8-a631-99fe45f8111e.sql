-- Réconciliation Parménion : libérer les cycles bloqués et marquer les décisions orphelines
UPDATE public.parmenion_decision_log
SET status = 'skipped_stale', execution_error = 'Réconciliation manuelle : phase audit jamais reprise (>30 min)', updated_at = now()
WHERE status = 'planned' AND created_at < now() - interval '30 minutes';

UPDATE public.autopilot_configs
SET status = 'idle', updated_at = now()
WHERE status = 'running' AND (last_cycle_at IS NULL OR last_cycle_at < now() - interval '2 hours');