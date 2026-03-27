
-- Monthly fair use check for content creation
-- Returns usage count for current billing month and whether the action is allowed
CREATE OR REPLACE FUNCTION public.check_monthly_fair_use(
  p_user_id uuid,
  p_action text,
  p_monthly_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_monthly_count integer;
  v_event_type text;
  v_month_start timestamptz;
BEGIN
  -- Admin bypass
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF v_is_admin THEN
    RETURN jsonb_build_object('allowed', true, 'is_admin', true);
  END IF;
  
  v_event_type := 'fair_use:' || p_action;
  v_month_start := date_trunc('month', now());
  
  -- Count usage this calendar month
  SELECT COUNT(*) INTO v_monthly_count
  FROM analytics_events
  WHERE user_id = p_user_id
    AND event_type = v_event_type
    AND created_at >= v_month_start;
  
  IF v_monthly_count >= p_monthly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'monthly_limit',
      'monthly_count', v_monthly_count,
      'monthly_limit', p_monthly_limit,
      'resets_at', (v_month_start + interval '1 month')::text
    );
  END IF;
  
  -- Record usage
  INSERT INTO analytics_events (user_id, event_type, event_data)
  VALUES (p_user_id, v_event_type, jsonb_build_object('action', p_action, 'month', to_char(now(), 'YYYY-MM')));
  
  RETURN jsonb_build_object(
    'allowed', true,
    'monthly_count', v_monthly_count + 1,
    'monthly_limit', p_monthly_limit
  );
END;
$$;
