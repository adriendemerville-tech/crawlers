
-- Drop old signature
DROP FUNCTION IF EXISTS public.score_spiral_priority(text, uuid, integer, text, boolean);

-- ═══ 1. Backfill function ═══
CREATE OR REPLACE FUNCTION public.backfill_workbench_spiral_data(p_domain text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assigned INTEGER := 0;
  v_scored INTEGER := 0;
  v_item RECORD;
  v_cluster_id uuid;
BEGIN
  FOR v_item IN
    SELECT w.id, w.domain, w.user_id, w.tracked_site_id, w.title, w.target_url,
           w.velocity_decay_score, w.competitor_momentum_score, w.gmb_urgency_score,
           w.conversion_weight, w.severity, w.cooldown_until
    FROM architect_workbench w
    WHERE w.cluster_id IS NULL
      AND w.status IN ('pending', 'in_progress', 'assigned')
      AND (p_domain IS NULL OR w.domain = p_domain)
  LOOP
    SELECT ku.cluster_id INTO v_cluster_id
    FROM keyword_universe ku
    WHERE ku.domain = v_item.domain AND ku.user_id = v_item.user_id
      AND ku.cluster_id IS NOT NULL
      AND (ku.target_url = v_item.target_url OR v_item.target_url ILIKE '%' || ku.keyword || '%')
    LIMIT 1;

    IF v_cluster_id IS NULL THEN
      SELECT cd.id INTO v_cluster_id
      FROM cluster_definitions cd
      WHERE cd.tracked_site_id = v_item.tracked_site_id
        AND cd.keywords && string_to_array(lower(regexp_replace(v_item.title, '[^a-zà-ÿ0-9 ]', ' ', 'gi')), ' ')
      LIMIT 1;
    END IF;

    IF v_cluster_id IS NOT NULL THEN
      UPDATE architect_workbench SET cluster_id = v_cluster_id WHERE id = v_item.id;
      v_assigned := v_assigned + 1;
    END IF;
  END LOOP;

  UPDATE architect_workbench w SET
    spiral_score = (
      LEAST(8, COALESCE(w.velocity_decay_score, 0) * 0.32)
      + LEAST(7, COALESCE(w.competitor_momentum_score, 0) * 0.35)
      + LEAST(7, COALESCE(w.gmb_urgency_score, 0) * 0.35)
      + (CASE w.severity WHEN 'danger' THEN 12 WHEN 'critical' THEN 12 WHEN 'warning' THEN 8 ELSE 5 END)
    ) * GREATEST(0.5, LEAST(3.0, COALESCE(w.conversion_weight, 1.0)))
    - CASE WHEN w.cooldown_until IS NOT NULL AND w.cooldown_until > now() THEN 30 ELSE 0 END
  WHERE w.status IN ('pending', 'in_progress', 'assigned')
    AND (p_domain IS NULL OR w.domain = p_domain);
  GET DIAGNOSTICS v_scored = ROW_COUNT;

  RETURN jsonb_build_object('clusters_assigned', v_assigned, 'scores_recalculated', v_scored);
END;
$function$;

-- ═══ 2. Cluster maturity recalculation trigger ═══
CREATE OR REPLACE FUNCTION public.recalc_cluster_maturity_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total INTEGER;
  v_done INTEGER;
  v_maturity NUMERIC;
BEGIN
  IF NEW.cluster_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('deployed', 'done'))
  INTO v_total, v_done
  FROM architect_workbench WHERE cluster_id = NEW.cluster_id;

  v_maturity := CASE WHEN v_total > 0 THEN ROUND((v_done::numeric / v_total::numeric) * 100, 1) ELSE 0 END;

  UPDATE cluster_definitions SET maturity_pct = v_maturity, total_items = v_total, deployed_items = v_done, updated_at = now()
  WHERE id = NEW.cluster_id;

  UPDATE architect_workbench SET cluster_maturity_pct = v_maturity
  WHERE cluster_id = NEW.cluster_id AND status IN ('pending', 'in_progress', 'assigned');

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalc_cluster_maturity_on_status ON architect_workbench;
CREATE TRIGGER trg_recalc_cluster_maturity_on_status
  AFTER UPDATE OF status ON architect_workbench
  FOR EACH ROW
  EXECUTE FUNCTION recalc_cluster_maturity_on_status();

-- ═══ 3. Updated score_spiral_priority ═══
CREATE OR REPLACE FUNCTION public.score_spiral_priority(
  p_domain text, p_user_id uuid, p_limit integer DEFAULT 20, p_lane text DEFAULT 'all', p_exclude_assigned boolean DEFAULT false
)
RETURNS TABLE(
  item_id uuid, title text, description text, finding_category text, action_type text,
  target_url text, target_selector text, target_operation text, severity text,
  payload jsonb, source_type text, spiral_score numeric, ring smallint,
  cluster_name text, cluster_maturity numeric, tier integer, lane text, priority_tag text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_current_month integer := EXTRACT(MONTH FROM v_now);
  v_site_market_sector text;
  v_site_id uuid;
BEGIN
  SELECT ts.id, ts.market_sector INTO v_site_id, v_site_market_sector
  FROM tracked_sites ts WHERE ts.domain = p_domain AND ts.user_id = p_user_id LIMIT 1;

  RETURN QUERY
  WITH
  seasonal_boost AS (
    SELECT COALESCE(MAX(
      CASE WHEN sc.impact_level = 'high' THEN 10 WHEN sc.impact_level = 'medium' THEN 6 ELSE 3 END
    ), 0) AS boost
    FROM seasonal_context sc
    WHERE (
      (sc.start_month < sc.end_month AND v_current_month BETWEEN sc.start_month AND sc.end_month)
      OR (sc.start_month > sc.end_month AND (v_current_month >= sc.start_month OR v_current_month <= sc.end_month))
      OR (sc.start_month = sc.end_month AND v_current_month = sc.start_month)
    ) AND (sc.sectors IS NULL OR v_site_market_sector = ANY(sc.sectors))
  ),
  anomaly_data AS (
    SELECT COALESCE(MAX(
      CASE WHEN aa.severity = 'danger' THEN 15 WHEN aa.severity = 'warning' THEN 8 ELSE 3 END
    ), 0) AS urgency
    FROM anomaly_alerts aa
    WHERE aa.tracked_site_id = v_site_id AND aa.detected_at > v_now - interval '7 days'
      AND aa.direction = 'down' AND aa.is_dismissed IS NOT TRUE
  ),
  scored_items AS (
    SELECT
      w.id, w.title, w.description, w.finding_category, w.action_type::text AS action_type,
      w.target_url, w.target_selector, w.target_operation, w.severity,
      w.payload, w.source_type::text AS source_type, w.priority_tag::text AS priority_tag,
      cd.ring AS item_ring, cd.cluster_name, cd.maturity_pct AS cluster_maturity,
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
      (
        (CASE COALESCE(cd.ring, 3) WHEN 1 THEN 18 WHEN 2 THEN 11 ELSE 5 END)
        + (CASE WHEN cd.maturity_pct IS NULL THEN 9 WHEN cd.maturity_pct < 30 THEN 18 WHEN cd.maturity_pct < 50 THEN 14 WHEN cd.maturity_pct < 70 THEN 9 WHEN cd.maturity_pct < 90 THEN 4 ELSE 1 END)
        + (CASE w.severity WHEN 'danger' THEN 12 WHEN 'critical' THEN 12 WHEN 'warning' THEN 8 WHEN 'info' THEN 3 ELSE 5 END)
        + LEAST(12, (SELECT urgency FROM anomaly_data))
        + LEAST(10, (SELECT boost FROM seasonal_boost))
        + LEAST(8, COALESCE(w.velocity_decay_score, 0) * 0.32)
        + LEAST(7, COALESCE(w.competitor_momentum_score, 0) * 0.35)
        + (CASE WHEN w.target_url IS NOT NULL THEN 5 ELSE 2 END)
        + LEAST(7, COALESCE(w.gmb_urgency_score, 0) * 0.35)
      ) * GREATEST(0.5, LEAST(3.0, COALESCE(w.conversion_weight, 1.0)))
      - (CASE WHEN w.cooldown_until IS NOT NULL AND w.cooldown_until > v_now THEN 30 ELSE 0 END)
      AS computed_score
    FROM architect_workbench w
    LEFT JOIN cluster_definitions cd ON cd.id = w.cluster_id
    WHERE w.domain = p_domain AND w.user_id = p_user_id
      AND w.status IN ('pending', 'in_progress', 'assigned')
      AND (p_lane = 'all'
        OR (p_lane = 'content' AND (w.action_type IN ('content', 'both') OR w.action_type IS NULL))
        OR (p_lane = 'tech' AND w.action_type IN ('code', 'both')))
      AND (NOT p_exclude_assigned OR w.assigned_to IS NULL)
  )
  SELECT si.id, si.title, si.description, si.finding_category, si.action_type,
    si.target_url, si.target_selector, si.target_operation, si.severity,
    si.payload, si.source_type,
    GREATEST(0, ROUND(si.computed_score, 2)) AS spiral_score,
    COALESCE(si.item_ring, 3::smallint) AS ring,
    si.cluster_name, COALESCE(si.cluster_maturity, 0) AS cluster_maturity,
    si.computed_tier AS tier, si.computed_lane AS lane, si.priority_tag
  FROM scored_items si
  ORDER BY si.computed_score DESC
  LIMIT p_limit;
END;
$function$;
