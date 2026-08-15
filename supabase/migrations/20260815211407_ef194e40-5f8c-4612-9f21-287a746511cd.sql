select cron.unschedule('marina-resume-stalled-5min');
select cron.schedule(
  'marina-resume-stalled-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"action":"reap_jobs"}'::jsonb
  );
  $$
);