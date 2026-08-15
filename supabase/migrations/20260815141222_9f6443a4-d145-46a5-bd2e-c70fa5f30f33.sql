SELECT cron.unschedule('kvp-oneshot-test');
SELECT cron.schedule(
  'kvp-selftest',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/google-ads-connector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET_V2' LIMIT 1)
    ),
    body := jsonb_build_object('action', 'volumes_selftest'),
    timeout_milliseconds := 60000
  );
  $$
);