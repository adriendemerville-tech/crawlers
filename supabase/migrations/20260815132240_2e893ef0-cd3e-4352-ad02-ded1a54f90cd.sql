-- Les crons GSC appelaient les fonctions avec la clé anon (aucun utilisateur => 401).
-- On repasse sur la clé service (stockée en vault) et on ajoute la détection d'anomalies quotidienne.

SELECT cron.unschedule('fetch-gsc-daily-positions');

SELECT cron.schedule(
  'fetch-gsc-daily-positions',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/fetch-gsc-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{"all": true, "days": 3, "sync_keywords": true}'::jsonb
  );
  $cron$
);

-- Rattrapage hebdomadaire : fenêtre 28 jours pour combler les trous de positions
SELECT cron.schedule(
  'fetch-gsc-backfill-weekly',
  '30 6 * * 1',
  $cron$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/fetch-gsc-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{"all": true, "days": 28, "sync_keywords": true}'::jsonb
  );
  $cron$
);

-- Détection d'anomalies : aucun cron n'existait, le signal anomaly_urgency restait donc inerte
SELECT cron.schedule(
  'detect-anomalies-daily',
  '0 7 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/detect-anomalies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{"all": true}'::jsonb
  );
  $cron$
);