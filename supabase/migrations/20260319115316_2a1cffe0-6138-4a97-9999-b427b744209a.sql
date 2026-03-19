
-- Table tracking last user activities per feature
CREATE TABLE public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  last_gmb_action_at timestamptz,
  last_gmb_location_name text,
  last_strategic_audit_at timestamptz,
  last_strategic_audit_url text,
  last_llm_depth_test_at timestamptz,
  last_llm_depth_test_url text,
  last_multi_crawl_at timestamptz,
  last_multi_crawl_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own activity log
CREATE POLICY "Users can view own activity" ON public.user_activity_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity" ON public.user_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity" ON public.user_activity_log
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Service role / admin full access
CREATE POLICY "Service role full access" ON public.user_activity_log
  FOR ALL TO service_role
  USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_user_activity_log_updated_at
  BEFORE UPDATE ON public.user_activity_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to upsert activity log entries
CREATE OR REPLACE FUNCTION public.upsert_user_activity(
  p_user_id uuid,
  p_field text,
  p_timestamp timestamptz DEFAULT now(),
  p_label text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO user_activity_log (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_field = 'gmb' THEN
    UPDATE user_activity_log SET last_gmb_action_at = p_timestamp, last_gmb_location_name = p_label WHERE user_id = p_user_id;
  ELSIF p_field = 'strategic_audit' THEN
    UPDATE user_activity_log SET last_strategic_audit_at = p_timestamp, last_strategic_audit_url = p_label WHERE user_id = p_user_id;
  ELSIF p_field = 'llm_depth' THEN
    UPDATE user_activity_log SET last_llm_depth_test_at = p_timestamp, last_llm_depth_test_url = p_label WHERE user_id = p_user_id;
  ELSIF p_field = 'multi_crawl' THEN
    UPDATE user_activity_log SET last_multi_crawl_at = p_timestamp, last_multi_crawl_url = p_label WHERE user_id = p_user_id;
  END IF;
END;
$$;
