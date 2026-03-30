
-- ═══ FIX: score_workbench_priority — per-lane consumed filtering ═══
-- Problem: AND consumed_by_code=false AND consumed_by_content=false excludes items from BOTH lanes
-- Fix: filter consumed flag based on the requested lane

CREATE OR REPLACE FUNCTION public.score_workbench_priority(
  p_domain text, 
  p_user_id uuid, 
  p_limit integer DEFAULT 10,
  p_lane text DEFAULT 'all',
  p_force_content boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, title text, description text, finding_category text, severity text, 
  target_url text, target_selector text, target_operation text, action_type text, 
  payload jsonb, source_type text, tier integer, base_score integer, 
  severity_bonus integer, aging_bonus integer, gate_malus integer, 
  total_score integer, created_at timestamp with time zone, lane text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tech_score NUMERIC := 100;
  v_gate_low INTEGER := 50;
  v_gate_high INTEGER := 70;
BEGIN
  -- Get tech score
  BEGIN
    SELECT COALESCE(
      (ard.raw_payload->>'overallScore')::numeric,
      (ard.raw_payload->'scores'->>'technical')::numeric,
      100
    ) INTO v_tech_score
    FROM audit_raw_data ard
    WHERE ard.domain = p_domain
      AND ard.audit_type IN ('technical', 'seo')
      AND ard.created_at > now() - interval '30 days'
    ORDER BY ard.created_at DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_tech_score := 100;
  END;

  -- Get custom gate thresholds from config
  BEGIN
    SELECT COALESCE(ac.gate_threshold_low, 50), COALESCE(ac.gate_threshold_high, 70)
    INTO v_gate_low, v_gate_high
    FROM autopilot_configs ac
    JOIN tracked_sites ts ON ts.id = ac.tracked_site_id
    WHERE ts.domain = p_domain AND ac.user_id = p_user_id AND ac.is_active = true
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_gate_low := 50;
    v_gate_high := 70;
  END;

  RETURN QUERY
  WITH scored AS (
    SELECT
      w.id, w.title, w.description, w.finding_category, w.severity,
      w.target_url, w.target_selector, w.target_operation,
      w.action_type::text, w.payload, w.source_type::text, w.created_at,
      -- Tier assignment
      CASE
        WHEN w.finding_category IN ('accessibility', 'security', 'http_errors', 'index_bloat') THEN 0
        WHEN w.finding_category IN ('speed', 'core_web_vitals') THEN 1
        WHEN w.finding_category IN ('broken_links', 'canonical', 'redirect_chain', 'crawl_errors', 'duplicate_content', 'robots', 'sitemap', 'mobile', 'orphan_pages') THEN 2
        WHEN w.finding_category IN ('structured_data') THEN 3
        WHEN w.finding_category IN ('meta_tags') THEN 4
        WHEN w.finding_category IN ('content_upgrade', 'thin_content', 'content_freshness', 'missing_terms') THEN 5
        WHEN w.finding_category IN ('linking', 'silo_structure', 'anchor_optimization') THEN 6
        WHEN w.finding_category IN ('cannibalization') THEN 7
        WHEN w.finding_category IN ('content_gap', 'competitive_gap', 'quick_win', 'serp_analysis') THEN 8
        WHEN w.finding_category IN ('missing_page') THEN 9
        WHEN w.finding_category IN ('topical_authority', 'geo_visibility', 'eeat', 'missing_content', 'keyword_data') THEN 10
        ELSE 6
      END AS computed_tier,
      -- Lane assignment
      CASE 
        WHEN w.finding_category IN ('accessibility', 'security', 'http_errors', 'index_bloat', 'speed', 'core_web_vitals', 'broken_links', 'canonical', 'redirect_chain', 'crawl_errors', 'duplicate_content', 'robots', 'sitemap', 'mobile', 'orphan_pages', 'structured_data', 'meta_tags') THEN 'tech'
        ELSE 'content'
      END AS computed_lane,
      -- Base score
      CASE
        WHEN w.finding_category IN ('accessibility', 'security', 'http_errors', 'index_bloat') THEN 1000
        WHEN w.finding_category IN ('speed', 'core_web_vitals') THEN 800
        WHEN w.finding_category IN ('broken_links', 'canonical', 'redirect_chain', 'crawl_errors', 'duplicate_content', 'robots', 'sitemap', 'mobile', 'orphan_pages') THEN 600
        WHEN w.finding_category IN ('structured_data') THEN 500
        WHEN w.finding_category IN ('meta_tags') THEN 400
        WHEN w.finding_category IN ('content_upgrade', 'thin_content', 'content_freshness', 'missing_terms') THEN 300
        WHEN w.finding_category IN ('linking', 'silo_structure', 'anchor_optimization') THEN 200
        WHEN w.finding_category IN ('cannibalization') THEN 150
        WHEN w.finding_category IN ('content_gap', 'competitive_gap', 'quick_win', 'serp_analysis') THEN 100
        WHEN w.finding_category IN ('missing_page') THEN 75
        WHEN w.finding_category IN ('topical_authority', 'geo_visibility', 'eeat', 'missing_content', 'keyword_data') THEN 50
        ELSE 200
      END AS computed_base_score,
      -- Severity bonus
      CASE w.severity
        WHEN 'critical' THEN 200
        WHEN 'high' THEN 100
        WHEN 'medium' THEN 0
        WHEN 'low' THEN -50
        ELSE 0
      END AS computed_severity_bonus,
      -- Aging bonus
      LEAST(100, GREATEST(0, EXTRACT(DAY FROM (now() - w.created_at))::integer * 10)) AS computed_aging_bonus
    FROM architect_workbench w
    WHERE w.domain = p_domain
      AND w.user_id = p_user_id
      AND w.status IN ('pending', 'assigned', 'in_progress')
      -- ═══ FIX: Per-lane consumed filtering ═══
      -- Tech lane: only care about consumed_by_code
      -- Content lane: only care about consumed_by_content
      -- All lane: show if either lane hasn't consumed it yet
      AND (
        CASE 
          WHEN p_lane = 'tech' THEN w.consumed_by_code = false
          WHEN p_lane = 'content' THEN w.consumed_by_content = false
          ELSE (w.consumed_by_code = false OR w.consumed_by_content = false)
        END
      )
  )
  SELECT
    s.id, s.title, s.description, s.finding_category, s.severity, s.target_url,
    s.target_selector, s.target_operation, s.action_type, s.payload, s.source_type,
    s.computed_tier,
    s.computed_base_score,
    s.computed_severity_bonus,
    s.computed_aging_bonus,
    CASE 
      WHEN p_force_content THEN 0
      WHEN s.computed_tier >= 7 AND v_tech_score < v_gate_high THEN -500
      WHEN s.computed_tier BETWEEN 5 AND 6 AND v_tech_score < v_gate_low THEN -300
      ELSE 0 
    END AS computed_gate_malus,
    s.computed_base_score + s.computed_severity_bonus + s.computed_aging_bonus 
      + (CASE 
          WHEN p_force_content THEN 0
          WHEN s.computed_tier >= 7 AND v_tech_score < v_gate_high THEN -500
          WHEN s.computed_tier BETWEEN 5 AND 6 AND v_tech_score < v_gate_low THEN -300
          ELSE 0 
        END) AS computed_total_score,
    s.created_at,
    s.computed_lane
  FROM scored s
  WHERE 
    (p_lane = 'all' OR s.computed_lane = p_lane)
  ORDER BY 
    s.computed_base_score + s.computed_severity_bonus + s.computed_aging_bonus 
      + (CASE 
          WHEN p_force_content THEN 0
          WHEN s.computed_tier >= 7 AND v_tech_score < v_gate_high THEN -500
          WHEN s.computed_tier BETWEEN 5 AND 6 AND v_tech_score < v_gate_low THEN -300
          ELSE 0 
        END) DESC,
    s.computed_tier ASC, s.created_at ASC
  LIMIT p_limit;
END;
$function$;

-- ═══ FIX: Reset stale in_progress items older than 24h back to pending ═══
-- This ensures the workbench is never permanently depleted
UPDATE architect_workbench
SET status = 'pending', consumed_by_code = false, consumed_by_content = false
WHERE status = 'in_progress'
  AND consumed_at < now() - interval '24 hours';
