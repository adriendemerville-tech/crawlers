-- Audit cache table: stores results for 1 hour to avoid duplicate IA costs
CREATE TABLE public.audit_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  function_name text NOT NULL,
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

-- Index for fast lookup and expiry cleanup
CREATE INDEX idx_audit_cache_key ON public.audit_cache(cache_key);
CREATE INDEX idx_audit_cache_expires ON public.audit_cache(expires_at);

-- RLS: service-only access (Edge Functions use service role key)
ALTER TABLE public.audit_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage audit cache"
  ON public.audit_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- Rate limiting function: counts user actions in a time window
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_count integer DEFAULT 10,
  p_window_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::interval;
  
  SELECT COUNT(*) INTO v_count
  FROM analytics_events
  WHERE user_id = p_user_id
    AND event_type = p_action
    AND created_at >= v_window_start;
  
  IF v_count >= p_max_count THEN
    RETURN jsonb_build_object('allowed', false, 'current_count', v_count, 'limit', p_max_count, 'window_minutes', p_window_minutes);
  END IF;
  
  RETURN jsonb_build_object('allowed', true, 'current_count', v_count, 'limit', p_max_count, 'window_minutes', p_window_minutes);
END;
$$;