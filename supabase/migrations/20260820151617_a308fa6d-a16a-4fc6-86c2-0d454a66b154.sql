UPDATE public.parmenion_targets
SET max_content_per_period = 1,
    throttle_period = 'week',
    updated_at = now()
WHERE domain = 'iktracker.fr';

-- Amorçage du compteur : les articles déjà publiés cette semaine n'étaient pas
-- tracés (contrainte CHECK sur phase/status). On pose une trace conforme pour
-- que le plafond 1/semaine s'applique dès maintenant.
INSERT INTO public.autopilot_modification_log
  (tracked_site_id, config_id, user_id, phase, action_type, status, description, diff_after)
VALUES
  ('81f43bbc-9209-4641-b8e3-3851a919b836', '6b8634bb-8141-4438-ae4f-b42e10d8d889',
   '51082f81-8971-4278-b70f-c1e880d2a934', 'implementation', 'create-post', 'applied',
   '[PUBLISH:backfill] Amorcage du plafond 1 article/semaine (surproduction constatee)',
   jsonb_build_object('backfill', true, 'reason', 'throttle_seed'));
