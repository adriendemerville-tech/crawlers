SELECT cron.schedule(
  'gsc-backfill-oneshot',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/fetch-gsc-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{"all": true, "days": 28, "sync_keywords": true}'::jsonb
  );
  $cron$
);