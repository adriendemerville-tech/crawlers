CREATE OR REPLACE FUNCTION public.get_bot_log_summary(p_tracked_site_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_entries bigint;
  v_total_bot_hits bigint;
  v_unique_bots bigint;
  v_error_hits bigint;
  v_top_bots jsonb;
  v_ai_bots jsonb;
  v_top_paths jsonb;
  v_error_rate numeric;
BEGIN
  -- Total entries in last 7 days
  SELECT COUNT(*) INTO v_total_entries
  FROM log_entries
  WHERE tracked_site_id = p_tracked_site_id
    AND ts >= now() - interval '7 days';

  IF v_total_entries = 0 THEN
    RETURN jsonb_build_object('total_entries', 0);
  END IF;

  -- Bot hits
  SELECT COUNT(*), COUNT(DISTINCT bot_name)
  INTO v_total_bot_hits, v_unique_bots
  FROM log_entries
  WHERE tracked_site_id = p_tracked_site_id
    AND ts >= now() - interval '7 days'
    AND is_bot = true;

  -- Error rate for bots
  SELECT COUNT(*) FILTER (WHERE status_code >= 400)
  INTO v_error_hits
  FROM log_entries
  WHERE tracked_site_id = p_tracked_site_id
    AND ts >= now() - interval '7 days'
    AND is_bot = true;

  v_error_rate := CASE WHEN v_total_bot_hits > 0
    THEN ROUND((v_error_hits::numeric / v_total_bot_hits::numeric) * 100, 1)
    ELSE 0 END;

  -- Top 10 bots
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_top_bots
  FROM (
    SELECT bot_name, COUNT(*) as hits
    FROM log_entries
    WHERE tracked_site_id = p_tracked_site_id
      AND ts >= now() - interval '7 days'
      AND is_bot = true
      AND bot_name IS NOT NULL
    GROUP BY bot_name
    ORDER BY hits DESC
    LIMIT 10
  ) t;

  -- AI bots specifically
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_ai_bots
  FROM (
    SELECT bot_name, COUNT(*) as hits
    FROM log_entries
    WHERE tracked_site_id = p_tracked_site_id
      AND ts >= now() - interval '7 days'
      AND is_bot = true
      AND bot_category = 'ai_crawler'
    GROUP BY bot_name
    ORDER BY hits DESC
  ) t;

  -- Top 10 paths crawled by bots
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_top_paths
  FROM (
    SELECT path, COUNT(*) as hits
    FROM log_entries
    WHERE tracked_site_id = p_tracked_site_id
      AND ts >= now() - interval '7 days'
      AND is_bot = true
      AND path IS NOT NULL
    GROUP BY path
    ORDER BY hits DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'total_entries', v_total_entries,
    'total_bot_hits', v_total_bot_hits,
    'unique_bots', v_unique_bots,
    'error_rate', v_error_rate,
    'top_bots', v_top_bots,
    'ai_bots', v_ai_bots,
    'top_paths', v_top_paths
  );
END;
$$;