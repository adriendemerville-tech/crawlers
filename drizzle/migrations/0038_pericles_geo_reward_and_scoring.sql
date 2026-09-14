CREATE OR REPLACE FUNCTION public.score_spiral_priority(p_domain text, p_user_id uuid, p_limit integer DEFAULT 20, p_lane text DEFAULT 'all'::text, p_exclude_assigned boolean DEFAULT false)
 RETURNS TABLE(item_id uuid, title text, description text, finding_category text, action_type text, target_url text, target_selector text, target_operation text, severity text, payload jsonb, source_type text, spiral_score numeric, ring smallint, cluster_name text, cluster_maturity numeric, tier integer, lane text, priority_tag text, lens_bonus numeric, lens_applied jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
  v_domain_reward numeric := 0;
BEGIN
  SELECT ts.id, ts.market_sector INTO v_site_id, v_site_market_sector
  FROM tracked_sites ts WHERE ts.domain = p_domain AND ts.user_id = p_user_id LIMIT 1;

  -- Récompense moyenne du domaine (mesurée à T+30), utilisée en repli
  SELECT COALESCE(AVG(reward_signal), 0) INTO v_domain_reward
  FROM pericles_decision_log
  WHERE domain = p_domain AND measured_at IS NOT NULL AND reward_signal IS NOT NULL
    AND measured_at > v_now - interval '180 days';

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
  -- Mémoire : récompense mesurée par cluster (T+30)
  cluster_reward AS (
    SELECT goal_cluster_id AS cluster_id, AVG(reward_signal) AS avg_reward
    FROM pericles_decision_log
    WHERE domain = p_domain AND goal_cluster_id IS NOT NULL
      AND measured_at IS NOT NULL AND reward_signal IS NOT NULL
      AND measured_at > v_now - interval '180 days'
    GROUP BY goal_cluster_id
  ),
  -- Mémoire : récompense IA (GEO) mesurée par cluster
  cluster_geo_reward AS (
    SELECT goal_cluster_id AS cluster_id, AVG(geo_reward_signal) AS avg_geo_reward
    FROM pericles_decision_log
    WHERE domain = p_domain AND goal_cluster_id IS NOT NULL
      AND geo_measured_at IS NOT NULL AND geo_reward_signal IS NOT NULL
      AND geo_measured_at > v_now - interval '180 days'
    GROUP BY goal_cluster_id
  ),
  -- Mémoire : échecs répétés par cluster (90 jours, les deux journaux)
  cluster_failures AS (
    SELECT cluster_id, SUM(n) AS fails FROM (
      SELECT goal_cluster_id AS cluster_id, COUNT(*) AS n
      FROM pericles_decision_log
      WHERE domain = p_domain AND goal_cluster_id IS NOT NULL
        AND created_at > v_now - interval '90 days'
        AND (is_error IS TRUE OR status IN ('failed', 'skipped_stale'))
      GROUP BY goal_cluster_id
      UNION ALL
      SELECT goal_cluster_id AS cluster_id, COUNT(*) AS n
      FROM parmenion_decision_log
      WHERE domain = p_domain AND goal_cluster_id IS NOT NULL
        AND created_at > v_now - interval '90 days'
        AND (is_error IS TRUE OR status IN ('failed', 'skipped_stale'))
      GROUP BY goal_cluster_id
    ) u GROUP BY cluster_id
  ),
  scored_items AS (
    SELECT
      w.id, w.title, w.description, w.finding_category, w.action_type::text AS action_type,
      w.target_url, w.target_selector, w.target_operation, w.severity,
      w.payload, w.source_type::text AS source_type, w.priority_tag::text AS priority_tag,
      w.cluster_id AS item_cluster_id,
      cd.ring AS item_ring, cd.cluster_name, cd.maturity_pct AS cluster_maturity,
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
      -- Réinjection du signal de récompense : ce qui a payé remonte, ce qui a nui descend
      + GREATEST(-15, LEAST(12, COALESCE(cr.avg_reward, v_domain_reward) * 0.15))
      -- Réinjection unique du signal IA (GEO), borné
      + GREATEST(-6, LEAST(6, COALESCE(cgr.avg_geo_reward, 0)))
      -- Pénalité d'échecs répétés (avant exclusion dure à 4 échecs)
      - LEAST(20, COALESCE(cf.fails, 0) * 6)
      -- Pénalité de tentatives de validation infructueuses sur l'item lui-même
      - LEAST(18, COALESCE(w.validate_attempts, 0) * 6)
      AS computed_score
    FROM architect_workbench w
    LEFT JOIN cluster_definitions cd ON cd.id = w.cluster_id
    LEFT JOIN cluster_reward cr ON cr.cluster_id = w.cluster_id
    LEFT JOIN cluster_geo_reward cgr ON cgr.cluster_id = w.cluster_id
    LEFT JOIN cluster_failures cf ON cf.cluster_id = w.cluster_id
    WHERE w.domain = p_domain AND w.user_id = p_user_id
      AND w.status IN ('pending', 'in_progress', 'assigned')
      AND (p_lane = 'all'
        OR (p_lane = 'content' AND (w.action_type IN ('content', 'both') OR w.action_type IS NULL))
        OR (p_lane = 'tech' AND w.action_type IN ('code', 'both')))
      AND (NOT p_exclude_assigned OR w.assigned_to IS NULL)
      -- Exclusion des échecs répétés : 3 tentatives de déploiement ratées
      AND COALESCE(w.validate_attempts, 0) < 3
      -- Exclusion des clusters qui échouent en boucle (sauf urgence réelle)
      AND (COALESCE(cf.fails, 0) < 4 OR w.severity IN ('critical', 'danger'))
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
  WHERE ri.cluster_rank <= 2
  ORDER BY (ri.computed_score + ri.computed_lens_bonus) DESC
  LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pericles_measure_rewards(
  p_domain text DEFAULT NULL,
  p_limit integer DEFAULT 200,
  p_window_days integer DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec record;
  v_measured integer := 0;
  v_skipped integer := 0;
  v_neg integer := 0;
  v_base record;
  v_after record;
  v_clicks_delta numeric;
  v_impr_delta numeric;
  v_ctr_delta numeric;
  v_pos_delta numeric;
  v_reward numeric;
  v_geo_base numeric;
  v_geo_last numeric;
  v_geo_reward numeric;
BEGIN
  FOR v_rec IN
    SELECT d.id, d.domain, d.execution_completed_at, d.spiral_score_at_decision,
           dr.min_date, dr.max_date
    FROM pericles_decision_log d
    JOIN LATERAL (
      SELECT MIN(g.date_val) AS min_date, MAX(g.date_val) AS max_date
      FROM gsc_daily_positions g WHERE g.domain = d.domain
    ) dr ON TRUE
    WHERE d.status = 'completed'
      AND d.measured_at IS NULL
      AND d.execution_completed_at IS NOT NULL
      AND (p_domain IS NULL OR d.domain = p_domain)
      AND dr.min_date IS NOT NULL
      AND d.execution_completed_at::date - p_window_days >= dr.min_date
      AND d.execution_completed_at::date + p_window_days <= dr.max_date
    ORDER BY d.execution_completed_at DESC
    LIMIT GREATEST(1, p_limit)
  LOOP
    SELECT COALESCE(SUM(clicks), 0) AS clicks, COALESCE(SUM(impressions), 0) AS impressions,
           COALESCE(AVG(position), 0) AS position
    INTO v_base
    FROM gsc_daily_positions
    WHERE domain = v_rec.domain
      AND date_val >= v_rec.execution_completed_at::date - p_window_days
      AND date_val < v_rec.execution_completed_at::date;

    SELECT COALESCE(SUM(clicks), 0) AS clicks, COALESCE(SUM(impressions), 0) AS impressions,
           COALESCE(AVG(position), 0) AS position
    INTO v_after
    FROM gsc_daily_positions
    WHERE domain = v_rec.domain
      AND date_val > v_rec.execution_completed_at::date
      AND date_val <= v_rec.execution_completed_at::date + p_window_days;

    IF v_base.impressions = 0 AND v_after.impressions = 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_clicks_delta := (v_after.clicks - v_base.clicks) / GREATEST(1, v_base.clicks)::numeric * 100;
    v_impr_delta := (v_after.impressions - v_base.impressions) / GREATEST(1, v_base.impressions)::numeric * 100;
    v_ctr_delta := (
      (v_after.clicks / GREATEST(1, v_after.impressions)::numeric)
      - (v_base.clicks / GREATEST(1, v_base.impressions)::numeric)
    ) / GREATEST(0.0001, v_base.clicks / GREATEST(1, v_base.impressions)::numeric) * 100;
    v_pos_delta := v_after.position - v_base.position;

    v_reward :=
      GREATEST(-25, LEAST(25, v_clicks_delta * 0.5)) * 0.40
      + GREATEST(-25, LEAST(25, -v_pos_delta * 3)) * 0.25
      + GREATEST(-25, LEAST(25, v_ctr_delta * 0.8)) * 0.20
      + GREATEST(-25, LEAST(25, v_impr_delta * 0.3)) * 0.15;

    IF COALESCE(v_rec.spiral_score_at_decision, 0) > 60 AND v_reward < -5 THEN
      v_reward := v_reward - (v_rec.spiral_score_at_decision - 60) / 40 * 10;
    END IF;

    v_reward := ROUND(GREATEST(-100, LEAST(100, v_reward))::numeric, 2);

    UPDATE pericles_decision_log SET
      baseline_clicks = v_base.clicks,
      baseline_impressions = v_base.impressions,
      baseline_ctr = ROUND((v_base.clicks / GREATEST(1, v_base.impressions)::numeric)::numeric, 5),
      baseline_position = ROUND(v_base.position::numeric, 2),
      t30_clicks = v_after.clicks,
      t30_impressions = v_after.impressions,
      t30_ctr = ROUND((v_after.clicks / GREATEST(1, v_after.impressions)::numeric)::numeric, 5),
      t30_position = ROUND(v_after.position::numeric, 2),
      reward_signal = v_reward,
      is_error = (v_reward <= -20),
      error_category = CASE WHEN v_reward <= -20 THEN 'negative_impact' ELSE error_category END,
      calibration_note = format('Mesure GSC %s j : clics %s%%, position %s, récompense %s',
        p_window_days, ROUND(v_clicks_delta, 1), ROUND(v_pos_delta, 2), v_reward),
      measured_at = now(),
      updated_at = now()
    WHERE id = v_rec.id;

    -- Récompense IA (GEO) : delta entre le snapshot de référence et le plus récent
    SELECT overall_score INTO v_geo_base
    FROM geo_visibility_snapshots
    WHERE pericles_decision_id = v_rec.id AND overall_score IS NOT NULL
    ORDER BY created_at ASC LIMIT 1;

    SELECT overall_score INTO v_geo_last
    FROM geo_visibility_snapshots
    WHERE pericles_decision_id = v_rec.id AND overall_score IS NOT NULL
    ORDER BY created_at DESC LIMIT 1;

    IF v_geo_base IS NOT NULL AND v_geo_last IS NOT NULL AND v_geo_last IS DISTINCT FROM v_geo_base THEN
      v_geo_reward := ROUND(GREATEST(-6, LEAST(6, (v_geo_last - v_geo_base) * 0.3))::numeric, 2);
      UPDATE pericles_decision_log
      SET geo_reward_signal = v_geo_reward, geo_measured_at = now()
      WHERE id = v_rec.id;
    END IF;

    -- Verdict de rentabilité sur les constats liés (distinct du statut technique)
    UPDATE architect_workbench
    SET reward_verdict = CASE WHEN v_reward > 0 THEN 'rewarded' ELSE 'regressed' END,
        reward_verdict_reason = format('Mesure GSC %s j : récompense %s', p_window_days, v_reward),
        reward_verdict_at = now()
    WHERE pericles_decision_id = v_rec.id AND reward_verdict = 'pending_measure';

    v_measured := v_measured + 1;
    IF v_reward < 0 THEN v_neg := v_neg + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'measured', v_measured,
    'skipped_no_gsc', v_skipped,
    'negative', v_neg,
    'window_days', p_window_days
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pericles_measure_rewards(text, integer, integer) TO service_role;