CREATE INDEX IF NOT EXISTS idx_startup_trial_tokens_status_expires
  ON public.startup_trial_signup_tokens (status, expires_at);

CREATE OR REPLACE FUNCTION public.purge_expired_startup_trial_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired integer := 0;
  v_deleted integer := 0;
BEGIN
  UPDATE public.startup_trial_signup_tokens
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  DELETE FROM public.startup_trial_signup_tokens
  WHERE status IN ('expired', 'used')
    AND expires_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_expired + v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_startup_trial_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_startup_trial_tokens() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('purge-expired-startup-trial-tokens');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-expired-startup-trial-tokens',
  '17 3 * * *',
  $$SELECT public.purge_expired_startup_trial_tokens();$$
);