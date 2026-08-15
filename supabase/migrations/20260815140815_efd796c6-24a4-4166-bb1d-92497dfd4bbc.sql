SELECT cron.schedule(
  'kvp-oneshot-test',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/google-ads-connector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET_V2' LIMIT 1)
    ),
    body := jsonb_build_object('action', 'backfill_all_volumes', 'limit', 50),
    timeout_milliseconds := 60000
  );
  $$
);