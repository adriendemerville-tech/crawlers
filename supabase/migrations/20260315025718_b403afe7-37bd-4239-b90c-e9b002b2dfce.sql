-- Consolidated fair use check: 1 RPC call instead of 3 queries
CREATE OR REPLACE FUNCTION public.check_fair_use_v2(
  p_user_id uuid,
  p_action text,
  p_hourly_limit integer,
  p_daily_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_hourly_count integer;
  v_daily_count integer;
  v_event_type text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF v_is_admin THEN
    RETURN jsonb_build_object('allowed', true, 'is_admin', true);
  END IF;
  
  v_event_type := 'fair_use:' || p_action;
  
  SELECT 
    COUNT(*) FILTER (WHERE created_at >= now() - interval '1 hour'),
    COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()))
  INTO v_hourly_count, v_daily_count
  FROM analytics_events
  WHERE user_id = p_user_id
    AND event_type = v_event_type
    AND created_at >= date_trunc('day', now());
  
  IF v_hourly_count >= p_hourly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit',
      'hourly_count', v_hourly_count,
      'daily_count', v_daily_count,
      'hourly_limit', p_hourly_limit,
      'daily_limit', p_daily_limit
    );
  END IF;
  
  IF v_daily_count >= p_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit',
      'hourly_count', v_hourly_count,
      'daily_count', v_daily_count,
      'hourly_limit', p_hourly_limit,
      'daily_limit', p_daily_limit
    );
  END IF;
  
  INSERT INTO analytics_events (user_id, event_type, event_data)
  VALUES (p_user_id, v_event_type, jsonb_build_object('plan', 'auto', 'action', p_action));
  
  RETURN jsonb_build_object(
    'allowed', true,
    'hourly_count', v_hourly_count + 1,
    'daily_count', v_daily_count + 1,
    'hourly_limit', p_hourly_limit,
    'daily_limit', p_daily_limit
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_analytics_events_fair_use 
ON analytics_events (user_id, event_type, created_at)
WHERE event_type LIKE 'fair_use:%';