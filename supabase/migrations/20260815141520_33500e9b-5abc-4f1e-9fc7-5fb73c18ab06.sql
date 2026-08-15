SELECT cron.unschedule('kvp-selftest');

SELECT cron.unschedule('keyword-planner-volumes-weekly');
SELECT cron.schedule(
  'keyword-planner-volumes-weekly',
  '15 5 * * 2',
  $$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/google-ads-connector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dGxpbXRhc25qYWJkZmhwZXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDk4MjMsImV4cCI6MjA4NDY4NTgyM30.RESxwIV0nhWCryZ5AxHEKQI5hhPw6Iiy5YLZXcl91FE',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET_V2' LIMIT 1)
    ),
    body := jsonb_build_object('action', 'backfill_all_volumes'),
    timeout_milliseconds := 120000
  );
  $$
);

SELECT cron.schedule(
  'kvp-selftest',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/google-ads-connector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dGxpbXRhc25qYWJkZmhwZXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDk4MjMsImV4cCI6MjA4NDY4NTgyM30.RESxwIV0nhWCryZ5AxHEKQI5hhPw6Iiy5YLZXcl91FE',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET_V2' LIMIT 1)
    ),
    body := jsonb_build_object('action', 'volumes_selftest'),
    timeout_milliseconds := 60000
  );
  $$
);