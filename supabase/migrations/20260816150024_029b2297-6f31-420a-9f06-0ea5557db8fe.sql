select cron.schedule(
  'marina-resume-stalled-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-marina-key', (SELECT api_key FROM public.marina_api_keys ORDER BY created_at LIMIT 1)
    ),
    body := '{"action":"reap_jobs"}'::jsonb
  );
  $$
);