ALTER TABLE public.cocoon_recommendations ADD COLUMN IF NOT EXISTS expired_at timestamptz;
ALTER TABLE public.cocoon_tasks ADD COLUMN IF NOT EXISTS expired_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cocoon_reco_stale ON public.cocoon_recommendations (created_at) WHERE is_applied = false AND expired_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cocoon_tasks_stale ON public.cocoon_tasks (created_at) WHERE expired_at IS NULL;

CREATE OR REPLACE FUNCTION public.expire_stale_cocoon_items()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_count integer := 0;
  t_count integer := 0;
BEGIN
  UPDATE public.cocoon_recommendations
     SET expired_at = now()
   WHERE is_applied = false
     AND expired_at IS NULL
     AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS r_count = ROW_COUNT;

  UPDATE public.cocoon_tasks
     SET expired_at = now(),
         status = 'expired',
         updated_at = now()
   WHERE expired_at IS NULL
     AND coalesce(execution_status, 'pending') NOT IN ('completed', 'success')
     AND status IN ('pending', 'planned', 'pending_validation')
     AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS t_count = ROW_COUNT;

  RETURN jsonb_build_object('recommendations_expired', r_count, 'tasks_expired', t_count);
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_cocoon_items() FROM public;
GRANT EXECUTE ON FUNCTION public.expire_stale_cocoon_items() TO service_role;

SELECT cron.unschedule('expire-stale-cocoon-items') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-cocoon-items');
SELECT cron.schedule('expire-stale-cocoon-items', '20 3 * * *', $$SELECT public.expire_stale_cocoon_items();$$);