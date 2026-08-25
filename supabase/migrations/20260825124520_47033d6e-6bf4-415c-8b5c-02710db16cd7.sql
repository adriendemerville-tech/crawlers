CREATE TABLE IF NOT EXISTS public.excluded_ips (
  ip_address text PRIMARY KEY,
  label      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.excluded_ips TO authenticated;
GRANT ALL ON public.excluded_ips TO service_role;

ALTER TABLE public.excluded_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage excluded ips" ON public.excluded_ips;
CREATE POLICY "admins manage excluded ips" ON public.excluded_ips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.ip_fingerprint(_ip text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN _ip IS NULL OR _ip = '' THEN NULL
              ELSE encode(sha256(convert_to(lower(btrim(_ip)), 'utf8')), 'hex') END
$$;

CREATE INDEX IF NOT EXISTS idx_analytics_events_signup_funnel
  ON public.analytics_events (created_at)
  WHERE event_type LIKE 'signup%';

CREATE OR REPLACE FUNCTION public.get_signup_funnel(days_back integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  start_date timestamptz;
  v_views bigint; v_oauth_start bigint; v_form_submit bigint;
  v_errors bigint; v_success bigint;
  v_google bigint; v_apple bigint; v_email bigint; v_new_users bigint;
  v_tracking_started timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  start_date := (CURRENT_DATE - GREATEST(COALESCE(days_back, 30), 1))::timestamptz;

  SELECT MIN(created_at) INTO v_tracking_started
  FROM public.analytics_events
  WHERE event_type = 'signup_view';

  WITH excluded AS (
    SELECT public.ip_fingerprint(ip_address) AS h FROM public.excluded_ips
  ), filt AS (
    SELECT ae.event_type, ae.event_data, ae.user_id
    FROM public.analytics_events ae
    WHERE ae.created_at >= start_date
      AND ae.event_type IN ('signup_view','signup_oauth_start','signup_oauth_return',
                            'signup_oauth_denied','signup_oauth_abandon',
                            'signup_form_submit','signup_error','signup_success')
      AND COALESCE(ae.event_data->>'page', 'signup') IN ('signup','auth')
      AND (ae.user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = ae.user_id AND ur.role = 'admin'))
      AND (ae.event_data->>'ip_hash' IS NULL OR NOT EXISTS (
            SELECT 1 FROM excluded e WHERE e.h = ae.event_data->>'ip_hash'))
  )
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'signup_view'),
    COUNT(*) FILTER (WHERE event_type = 'signup_oauth_start'),
    COUNT(*) FILTER (WHERE event_type = 'signup_form_submit'),
    COUNT(*) FILTER (WHERE event_type = 'signup_error'),
    COUNT(*) FILTER (WHERE event_type = 'signup_success'),
    COUNT(*) FILTER (WHERE event_type = 'signup_success' AND event_data->>'context' = 'google'),
    COUNT(*) FILTER (WHERE event_type = 'signup_success' AND event_data->>'context' = 'apple'),
    COUNT(*) FILTER (WHERE event_type = 'signup_success' AND event_data->>'context' = 'email')
  INTO v_views, v_oauth_start, v_form_submit, v_errors, v_success, v_google, v_apple, v_email
  FROM filt;

  SELECT COUNT(*) INTO v_new_users
  FROM auth.users u
  WHERE u.created_at >= start_date
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur
                    WHERE ur.user_id = u.id AND ur.role = 'admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.analytics_events ae
      JOIN public.excluded_ips ei
        ON public.ip_fingerprint(ei.ip_address) = ae.event_data->>'ip_hash'
      WHERE ae.user_id = u.id
        AND ae.event_type IN ('signup_success','signup_form_submit','signup_oauth_start'));

  RETURN json_build_object(
    'days_back', days_back,
    'tracking_started_at', v_tracking_started,
    'views', COALESCE(v_views,0),
    'oauth_start', COALESCE(v_oauth_start,0),
    'form_submit', COALESCE(v_form_submit,0),
    'errors', COALESCE(v_errors,0),
    'success_tracked', COALESCE(v_success,0),
    'new_users', COALESCE(v_new_users,0),
    'by_provider', json_build_object('google', COALESCE(v_google,0),
                                     'apple', COALESCE(v_apple,0),
                                     'email', COALESCE(v_email,0)),
    'conversion_rate', CASE WHEN COALESCE(v_views,0) > 0
      THEN ROUND((v_new_users::numeric / v_views::numeric) * 100, 1) ELSE 0 END,
    'error_rate', CASE WHEN COALESCE(v_form_submit,0) > 0
      THEN ROUND((v_errors::numeric / v_form_submit::numeric) * 100, 1) ELSE 0 END,
    'top_errors', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT ae.event_data->>'context' AS message, COUNT(*) AS count
        FROM public.analytics_events ae
        WHERE ae.created_at >= start_date
          AND ae.event_type = 'signup_error'
          AND ae.event_data->>'context' IS NOT NULL
        GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 5) t)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_signup_funnel(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signup_funnel(integer) TO authenticated;