-- 1) Le reaper générique ne doit plus tuer les jobs Marina qui disposent d'un
--    point de reprise valide : Marina sait les relancer lui-même.
CREATE OR REPLACE FUNCTION public.reap_zombie_async_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reaped_count integer;
BEGIN
  UPDATE public.async_jobs j
  SET status='failed',
      error_message='Edge function killed (CPU wall-time exceeded) — auto-reaped',
      completed_at=now()
  WHERE j.status = 'processing'
    AND COALESCE(j.updated_at, j.started_at, j.created_at) < now() - interval '15 minutes'
    AND NOT (
      j.function_name = 'marina'
      AND COALESCE(j.updated_at, j.started_at, j.created_at) > now() - interval '90 minutes'
      AND EXISTS (
        SELECT 1 FROM public.audit_cache c
        WHERE c.cache_key = 'marina_checkpoint_' || j.id::text
          AND (c.expires_at IS NULL OR c.expires_at > now())
          AND COALESCE((c.result_data->>'resumes')::int, 0) < 6
      )
    );
  GET DIAGNOSTICS reaped_count = ROW_COUNT;

  UPDATE public.async_jobs j
  SET status='failed',
      error_message='Timeout: job resté en file d''attente sans worker actif',
      completed_at=now()
  WHERE j.status = 'pending'
    AND (
      j.created_at < now() - interval '3 hours'
      OR (
        j.created_at < now() - interval '30 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM public.async_jobs p
          WHERE p.function_name = j.function_name
            AND p.status = 'processing'
        )
      )
    );
  RETURN reaped_count;
END;
$$;

-- 2) Le cron de reprise Marina envoyait un Bearer vide (paramètre
--    app.settings.service_role_key inexistant) → 401, aucune reprise réelle.
--    On utilise la clé de service stockée dans le vault.
SELECT cron.unschedule('marina-resume-stalled-5min');
SELECT cron.schedule(
  'marina-resume-stalled-5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{"action":"reap_jobs"}'::jsonb
  );
  $cron$
);