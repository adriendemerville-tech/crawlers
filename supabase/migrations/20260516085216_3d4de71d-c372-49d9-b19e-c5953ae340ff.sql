-- 1) Mark current zombie jobs (processing > 5 min) as failed
UPDATE public.async_jobs
SET status='failed',
    error_message='Edge function killed (CPU wall-time exceeded) — auto-reaped',
    completed_at=now()
WHERE function_name='content-architecture-advisor'
  AND status IN ('processing','pending')
  AND created_at < now() - interval '5 minutes';

-- 2) Reaper function: marks any async_job stuck in processing/pending > 8 min as failed
CREATE OR REPLACE FUNCTION public.reap_zombie_async_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reaped_count integer;
BEGIN
  UPDATE public.async_jobs
  SET status='failed',
      error_message='Edge function killed (CPU wall-time exceeded) — auto-reaped',
      completed_at=now()
  WHERE status IN ('processing','pending')
    AND created_at < now() - interval '8 minutes';
  GET DIAGNOSTICS reaped_count = ROW_COUNT;
  RETURN reaped_count;
END;
$$;

-- 3) Schedule reaper every 5 minutes
SELECT cron.unschedule('reap-zombie-async-jobs') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname='reap-zombie-async-jobs'
);

SELECT cron.schedule(
  'reap-zombie-async-jobs',
  '*/5 * * * *',
  $$ SELECT public.reap_zombie_async_jobs(); $$
);