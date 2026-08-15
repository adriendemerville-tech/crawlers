SELECT vault.create_secret('c669214e6e8459e5bcd0b836fe20b7202a994c594aae327d', 'cron_secret_v2', 'Secret partagé pour authentifier les appels cron aux edge functions');

SELECT cron.unschedule('fetch-gsc-daily-positions');
SELECT cron.unschedule('fetch-gsc-backfill-weekly');
SELECT cron.unschedule('detect-anomalies-daily');

SELECT cron.schedule('fetch-gsc-daily-positions', '0 6 * * *', $cron$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/fetch-gsc-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_v2')
    ),
    body := '{"all": true, "days": 3, "sync_keywords": true}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);

SELECT cron.schedule('fetch-gsc-backfill-weekly', '30 6 * * 1', $cron$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/fetch-gsc-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_v2')
    ),
    body := '{"all": true, "days": 28, "sync_keywords": true}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);

SELECT cron.schedule('detect-anomalies-daily', '0 7 * * *', $cron$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/detect-anomalies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_v2')
    ),
    body := '{"all": true}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);

DROP FUNCTION IF EXISTS public.trigger_gsc_sync(integer, boolean);