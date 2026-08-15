SELECT cron.unschedule('keyword-planner-volumes-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'keyword-planner-volumes-weekly');

SELECT cron.schedule(
  'keyword-planner-volumes-weekly',
  '15 5 * * 2',
  $$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/google-ads-connector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET_V2' LIMIT 1)
    ),
    body := jsonb_build_object('action', 'backfill_all_volumes'),
    timeout_milliseconds := 120000
  );
  $$
);