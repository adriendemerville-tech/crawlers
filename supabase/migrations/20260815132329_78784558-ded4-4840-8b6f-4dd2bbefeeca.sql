CREATE OR REPLACE FUNCTION public.trigger_gsc_sync(p_days integer DEFAULT 3, p_sync_keywords boolean DEFAULT true)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_key text;
  v_rid bigint;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key';
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/fetch-gsc-daily',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('all', true, 'days', p_days, 'sync_keywords', p_sync_keywords)
  ) INTO v_rid;
  RETURN v_rid;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_gsc_sync(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_gsc_sync(integer, boolean) TO service_role;