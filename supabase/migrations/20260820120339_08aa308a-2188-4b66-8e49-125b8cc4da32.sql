CREATE OR REPLACE FUNCTION public.reset_stuck_workbench_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH reset AS (
    UPDATE public.architect_workbench
       SET status = 'pending',
           updated_at = now()
     WHERE status = 'in_progress'
       AND updated_at < now() - interval '2 hours'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM reset;

  IF v_count > 0 THEN
    RAISE LOG '[workbench] reset_stuck_workbench_items: % constats repassés en pending', v_count;
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_stuck_workbench_items() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_stuck_workbench_items() TO service_role;

SELECT cron.schedule(
  'workbench-reset-stuck-15min',
  '*/15 * * * *',
  $$SELECT public.reset_stuck_workbench_items();$$
);