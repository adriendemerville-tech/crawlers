SELECT cron.unschedule('content-freshness-audit-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'content-freshness-audit-weekly');

SELECT cron.schedule(
  'content-freshness-audit-weekly',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/content-freshness',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"action":"scan"}'::jsonb
  );
  $$
);