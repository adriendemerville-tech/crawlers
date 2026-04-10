-- ══════════════════════════════════════════
-- 1. Table seasonal_news_cache
-- ══════════════════════════════════════════
CREATE TABLE public.seasonal_news_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector TEXT NOT NULL,
  geo_zone TEXT NOT NULL DEFAULT 'FR',
  headline TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  source_name TEXT,
  news_type TEXT NOT NULL DEFAULT 'sectorial',
  relevance_score INTEGER DEFAULT 50,
  keywords TEXT[] DEFAULT '{}',
  related_event_id UUID REFERENCES public.seasonal_context(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_seasonal_news_sector ON public.seasonal_news_cache(sector);
CREATE INDEX idx_seasonal_news_expires ON public.seasonal_news_cache(expires_at);
CREATE INDEX idx_seasonal_news_type ON public.seasonal_news_cache(news_type);

-- RLS: public read, service-role write
ALTER TABLE public.seasonal_news_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read seasonal news"
  ON public.seasonal_news_cache FOR SELECT
  USING (true);

-- ══════════════════════════════════════════
-- 2. Add seasonal_roi_boost to workbench scoring
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.score_workbench_priority(
  p_domain text, p_user_id uuid, p_limit integer DEFAULT 10, 
  p_lane text DEFAULT 'all'::text, p_force_content boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, title text, description text, finding_category text, severity text,
  target_url text, target_selector text, target_operation text, action_type text,
  payload jsonb, source_type text, tier integer, base_score integer,
  severity_bonus integer, aging_bonus integer, gate_malus integer,
  total_score integer, created_at timestamp with time zone, lane text,
  priority_tag text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tech_score NUMERIC := 100;
  v_gate_low INTEGER := 50;
  v_gate_high INTEGER := 70;
  v_site_sector TEXT;
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
    ORDER BY ard.created_at DESC LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_tech_score := 100;
  END;

  -- Get gate thresholds
  BEGIN
    SELECT COALESCE(ac.gate_threshold_low, 50), COALESCE(ac.gate_threshold_high, 70)
    INTO v_gate_low, v_gate_high
    FROM autopilot_configs ac
    JOIN tracked_sites ts ON ts.id = ac.tracked_site_id
    WHERE ts.domain = p_domain AND ac.user_id = p_user_id AND ac.is_active = true
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_gate_low := 50; v_gate_high := 70;
  END;

  -- Get site sector for seasonal boost
  BEGIN
    SELECT ts.market_sector INTO v_site_sector
    FROM tracked_sites ts
    WHERE ts.domain = p_domain AND ts.user_id = p_user_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_site_sector := NULL;
  END;

  RETURN QUERY
  WITH seasonal_keywords AS (
    SELECT UNNEST(sc.peak_keywords) AS kw
    FROM seasonal_context sc
    WHERE sc.is_recurring = true
      AND (v_site_sector IS NULL OR v_site_sector = ANY(sc.sectors) OR sc.sectors = '{}')
      AND (
        -- Currently in peak
        EXTRACT(MONTH FROM CURRENT_DATE) BETWEEN sc.start_month AND COALESCE(sc.end_month, sc.start_month)
        OR
        -- In prep window
        (make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, sc.start_month, sc.start_day) - (sc.prep_weeks_before * 7)) <= CURRENT_DATE
        AND CURRENT_DATE < make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, sc.start_month, sc.start_day)
      )
  ),
  scored AS (
    SELECT
      w.id, w.title, w.description, w.finding_category, w.severity,
      w.target_url, w.target_selector, w.target_operation,
      w.action_type::text, w.payload, w.source_type::text, w.created_at,
      w.priority_tag::text AS p_tag,
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
        WHEN w.finding_category IN ('accessibility', 'security', 'http_errors', 'index_bloat', 'speed', 'core_web_vitals', 'broken_links', 'canonical', 'redirect_chain', 'crawl_errors', 'duplicate_content', 'robots', 'sitemap', 'mobile', 'orphan_pages', 'structured_data', 'meta_tags') THEN 'tech'
        ELSE 'content'
      END AS computed_lane,
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
        WHEN 'critical' THEN 200 WHEN 'high' THEN 100 WHEN 'medium' THEN 0 WHEN 'low' THEN -50 ELSE 0
      END AS computed_severity_bonus,
      LEAST(100, GREATEST(0, EXTRACT(DAY FROM (now() - w.created_at))::integer * 10)) AS computed_aging_bonus,
      -- SEASONAL ROI BOOST: +150 if finding keywords match active seasonal keywords
      CASE WHEN EXISTS (
        SELECT 1 FROM seasonal_keywords sk
        WHERE LOWER(w.title) LIKE '%' || LOWER(sk.kw) || '%'
           OR LOWER(COALESCE(w.description, '')) LIKE '%' || LOWER(sk.kw) || '%'
           OR LOWER(COALESCE(w.payload->>'keyword', '')) LIKE '%' || LOWER(sk.kw) || '%'
      ) THEN 150 ELSE 0 END AS seasonal_boost
    FROM architect_workbench w
    WHERE w.domain = p_domain
      AND w.user_id = p_user_id
      AND w.status IN ('pending', 'assigned', 'in_progress')
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
    s.computed_base_score + s.computed_severity_bonus + s.computed_aging_bonus + s.seasonal_boost
      + (CASE 
          WHEN p_force_content THEN 0
          WHEN s.computed_tier >= 7 AND v_tech_score < v_gate_high THEN -500
          WHEN s.computed_tier BETWEEN 5 AND 6 AND v_tech_score < v_gate_low THEN -300
          ELSE 0 
        END) AS computed_total_score,
    s.created_at,
    s.computed_lane,
    s.p_tag
  FROM scored s
  WHERE (p_lane = 'all' OR s.computed_lane = p_lane)
  ORDER BY 
    s.computed_base_score + s.computed_severity_bonus + s.computed_aging_bonus + s.seasonal_boost
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

-- ══════════════════════════════════════════
-- 3. Helper: get seasonal news for a sector
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_seasonal_news(p_sector text DEFAULT NULL, p_geo text DEFAULT 'FR', p_limit integer DEFAULT 5)
RETURNS TABLE(
  headline text, summary text, source_url text, source_name text,
  news_type text, relevance_score integer, keywords text[], created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT sn.headline, sn.summary, sn.source_url, sn.source_name,
         sn.news_type, sn.relevance_score, sn.keywords, sn.created_at
  FROM seasonal_news_cache sn
  WHERE sn.expires_at > now()
    AND sn.geo_zone = p_geo
    AND (p_sector IS NULL OR LOWER(sn.sector) = LOWER(p_sector) OR sn.sector = 'all')
  ORDER BY sn.relevance_score DESC, sn.created_at DESC
  LIMIT p_limit;
$$;