select cron.schedule(
  'marina-batch-tick-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--835346f4-264a-44e7-b41d-731dbcae8d65.lovable.app/api/public/hooks/marina-batch-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_v2')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);