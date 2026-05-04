-- Cron hebdo : régénère docs/deferred-tasks.md chaque lundi à 06h00 UTC
SELECT cron.schedule(
  'cron-update-deferred-tasks',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/update-deferred-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);