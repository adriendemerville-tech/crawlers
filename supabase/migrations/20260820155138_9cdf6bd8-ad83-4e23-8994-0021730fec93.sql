SELECT cron.unschedule('content-freshness-audit-weekly');

SELECT cron.schedule(
  'content-freshness-audit-weekly',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/content-freshness',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_v2')
    ),
    body := '{"action":"scan"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);