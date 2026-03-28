
CREATE OR REPLACE FUNCTION public.score_workbench_priority(
  p_domain TEXT,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  description TEXT,
  finding_category TEXT,
  severity TEXT,
  target_url TEXT,
  action_type TEXT,
  payload JSONB,
  source_type TEXT,
  tier INTEGER,
  base_score INTEGER,
  severity_bonus INTEGER,
  aging_bonus INTEGER,
  gate_malus INTEGER,
  total_score INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tech_score NUMERIC := 100;
BEGIN
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

  RETURN QUERY
  WITH scored AS (
    SELECT
      w.id,
      w.title,
      w.description,
      w.finding_category,
      w.severity,
      w.target_url,
      w.action_type::text,
      w.payload,
      w.source_type::text,
      w.created_at,
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
      CASE w.severity
        WHEN 'critical' THEN 200
        WHEN 'high' THEN 100
        WHEN 'medium' THEN 0
        WHEN 'low' THEN -50
        ELSE 0
      END AS computed_severity_bonus,
      LEAST(100, GREATEST(0, EXTRACT(DAY FROM (now() - w.created_at))::integer * 10)) AS computed_aging_bonus
    FROM architect_workbench w
    WHERE w.domain = p_domain
      AND w.user_id = p_user_id
      AND w.status IN ('pending', 'assigned', 'in_progress')
      AND w.consumed_by_code = false
      AND w.consumed_by_content = false
  )
  SELECT
    s.id, s.title, s.description, s.finding_category, s.severity, s.target_url,
    s.action_type, s.payload, s.source_type, s.computed_tier, s.computed_base_score,
    s.computed_severity_bonus, s.computed_aging_bonus,
    CASE WHEN s.computed_tier >= 5 AND v_tech_score < 70 THEN -500 ELSE 0 END AS computed_gate_malus,
    s.computed_base_score + s.computed_severity_bonus + s.computed_aging_bonus 
      + (CASE WHEN s.computed_tier >= 5 AND v_tech_score < 70 THEN -500 ELSE 0 END) AS computed_total_score,
    s.created_at
  FROM scored s
  ORDER BY 
    s.computed_base_score + s.computed_severity_bonus + s.computed_aging_bonus 
      + (CASE WHEN s.computed_tier >= 5 AND v_tech_score < 70 THEN -500 ELSE 0 END) DESC,
    s.computed_tier ASC, s.created_at ASC
  LIMIT p_limit;
END;
$$;
