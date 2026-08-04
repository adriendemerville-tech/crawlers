SELECT cron.unschedule('compute-spiral-signals-6h');
SELECT cron.schedule(
  'compute-spiral-signals-6h',
  '15 */6 * * *',
  $CRON$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/compute-spiral-signals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"all": true}'::jsonb
  );
  $CRON$
);