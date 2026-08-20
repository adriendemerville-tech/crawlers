SELECT cron.unschedule('link-health-audit-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'link-health-audit-daily');

SELECT cron.schedule(
  'link-health-audit-daily',
  '30 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--835346f4-264a-44e7-b41d-731dbcae8d65.lovable.app/api/public/hooks/link-health-scan?limit=12',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_v2')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);