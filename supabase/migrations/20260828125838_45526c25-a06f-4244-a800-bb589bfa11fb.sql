ALTER TABLE public.competitor_matrix_jobs
  ADD COLUMN IF NOT EXISTS lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cmj_running_lock
  ON public.competitor_matrix_jobs (status, lock_until, updated_at);

SELECT cron.schedule(
  'competitor-matrix-tick-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--835346f4-264a-44e7-b41d-731dbcae8d65.lovable.app/api/public/hooks/competitor-matrix-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);