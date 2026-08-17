DROP FUNCTION IF EXISTS public.score_spiral_priority(text, uuid, integer, text, boolean);

CREATE OR REPLACE FUNCTION public.score_spiral_priority(
  p_domain text, p_user_id uuid, p_limit integer DEFAULT 20, p_lane text DEFAULT 'all', p_exclude_assigned boolean DEFAULT false
)
RETURNS TABLE(
  item_id uuid, title text, description text, finding_category text, action_type text,
  target_url text, target_selector text, target_operation text, severity text,
  payload jsonb, source_type text, spiral_score numeric, ring smallint,
  cluster_name text, cluster_maturity numeric, tier integer, lane text, priority_tag text,
  lens_bonus numeric, lens_applied jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_current_month integer := EXTRACT(MONTH FROM v_now);
  v_site_market_sector text;
  v_site_id uuid;
  v_lens_clusters uuid[] := '{}';
  v_lens_personas text[] := '{}';
  v_lens_locations text[] := '{}';
  v_lens_meta jsonb := '{}'::jsonb;
BEGIN
  SELECT ts.id, ts.market_sector INTO v_site_id, v_site_market_sector
  FROM tracked_sites ts WHERE ts.domain = p_domain AND ts.user_id = p_user_id LIMIT 1;

  -- Lentilles de ciblage actives (proof mesurée uniquement)
  SELECT
    COALESCE((SELECT array_agg(DISTINCT (v)::uuid) FROM parmenion_targeting_lenses l
      JOIN parmenion_targets t ON t.id = l.target_id
      CROSS JOIN LATERAL jsonb_array_elements_text(l.values) AS v
      WHERE t.domain = p_domain AND l.enabled AND l.lens_type = 'cluster'
        AND l.proof_level IN ('weak','strong') AND v ~* '^[0-9a-f-]{36}$'), '{}'),
    COALESCE((SELECT array_agg(DISTINCT lower(v)) FROM parmenion_targeting_lenses l
      JOIN parmenion_targets t ON t.id = l.target_id
      CROSS JOIN LATERAL jsonb_array_elements_text(l.values) AS v
      WHERE t.domain = p_domain AND l.enabled AND l.lens_type = 'persona'
        AND l.proof_level IN ('weak','strong')), '{}'),
    COALESCE((SELECT array_agg(DISTINCT lower(v)) FROM parmenion_targeting_lenses l
      JOIN parmenion_targets t ON t.id = l.target_id
      CROSS JOIN LATERAL jsonb_array_elements_text(l.values) AS v
      WHERE t.domain = p_domain AND l.enabled AND l.lens_type = 'location'
        AND l.proof_level IN ('weak','strong')), '{}'),
    COALESCE((SELECT jsonb_object_agg(l.lens_type, jsonb_build_object(
        'share_pct', l.share_pct, 'publish_directory', l.publish_directory,
        'conversion_target', l.conversion_target, 'proof_level', l.proof_level))
      FROM parmenion_targeting_lenses l
      JOIN parmenion_targets t ON t.id = l.target_id
      WHERE t.domain = p_domain AND l.enabled AND l.proof_level IN ('weak','strong')), '{}'::jsonb)
  INTO v_lens_clusters, v_lens_personas, v_lens_locations, v_lens_meta;

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
      w.cluster_id AS item_cluster_id,
      cd.ring AS item_ring, cd.cluster_name, cd.maturity_pct AS cluster_maturity,
      -- item de CRÉATION uniquement : la lentille n'agit pas sur l'existant
      (w.finding_category IN ('missing_page','content_gap','missing_content','competitive_gap')) AS is_creation,
      lower(coalesce(w.title,'') || ' ' || coalesce(w.description,'') || ' ' || coalesce(w.payload::text,'')) AS haystack,
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
  ),
  lensed_items AS (
    SELECT si.*,
      (si.is_creation AND si.item_cluster_id IS NOT NULL AND si.item_cluster_id = ANY(v_lens_clusters)) AS m_cluster,
      (si.is_creation AND EXISTS (SELECT 1 FROM unnest(v_lens_personas) AS p WHERE length(p) > 2 AND si.haystack LIKE '%' || p || '%')) AS m_persona,
      (si.is_creation AND EXISTS (SELECT 1 FROM unnest(v_lens_locations) AS g WHERE length(g) > 2 AND si.haystack LIKE '%' || g || '%')) AS m_location
    FROM scored_items si
  ),
  bonused_items AS (
    SELECT li.*,
      LEAST(8, (CASE WHEN li.m_cluster THEN 8 ELSE 0 END)
             + (CASE WHEN li.m_persona THEN 6 ELSE 0 END)
             + (CASE WHEN li.m_location THEN 6 ELSE 0 END))::numeric AS computed_lens_bonus
    FROM lensed_items li
  ),
  -- CLUSTER DIVERSITY: rank items within each cluster, cap at 2 per cluster
  ranked_items AS (
    SELECT bi.*,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(bi.item_cluster_id, bi.id)
        ORDER BY (bi.computed_score + bi.computed_lens_bonus) DESC
      ) AS cluster_rank
    FROM bonused_items bi
  )
  SELECT ri.id, ri.title, ri.description, ri.finding_category, ri.action_type,
    ri.target_url, ri.target_selector, ri.target_operation, ri.severity,
    ri.payload, ri.source_type,
    GREATEST(0, ROUND(ri.computed_score + ri.computed_lens_bonus, 2)) AS spiral_score,
    COALESCE(ri.item_ring, 3::smallint) AS ring,
    ri.cluster_name, COALESCE(ri.cluster_maturity, 0) AS cluster_maturity,
    ri.computed_tier AS tier, ri.computed_lane AS lane, ri.priority_tag,
    ri.computed_lens_bonus AS lens_bonus,
    CASE WHEN ri.computed_lens_bonus > 0 THEN jsonb_build_object(
      'types', (CASE WHEN ri.m_cluster THEN jsonb_build_array('cluster') ELSE '[]'::jsonb END)
             || (CASE WHEN ri.m_persona THEN jsonb_build_array('persona') ELSE '[]'::jsonb END)
             || (CASE WHEN ri.m_location THEN jsonb_build_array('location') ELSE '[]'::jsonb END),
      'config', v_lens_meta
    ) ELSE NULL END AS lens_applied
  FROM ranked_items ri
  WHERE ri.cluster_rank <= 2  -- Max 2 items per cluster
  ORDER BY (ri.computed_score + ri.computed_lens_bonus) DESC
  LIMIT p_limit;
END;
$function$;