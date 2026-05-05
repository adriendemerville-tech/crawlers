
UPDATE public.parmenion_decision_log
SET status = 'cancelled'
WHERE domain = 'iktracker.fr' AND status = 'planned';

UPDATE public.autopilot_configs
SET status = 'idle'
WHERE tracked_site_id IN (SELECT id FROM public.tracked_sites WHERE domain = 'iktracker.fr')
  AND status = 'paused';

UPDATE public.autopilot_configs
SET implementation_mode = 'auto'
WHERE tracked_site_id IN (SELECT id FROM public.tracked_sites WHERE domain = 'dictadevi.io')
  AND implementation_mode = 'dry_run';
