
CREATE OR REPLACE FUNCTION public.score_spiral_priority(
  p_domain text,
  p_user_id uuid,
  p_limit integer DEFAULT 20,
  p_lane text DEFAULT 'all',
  p_exclude_assigned boolean DEFAULT false
)
RETURNS TABLE(
  item_id uuid,
  title text,
  finding_category text,
  action_type text,
  target_url text,
  severity text,
  spiral_score numeric,
  ring smallint,
  cluster_name text,
  cluster_maturity numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_current_month integer := EXTRACT(MONTH FROM v_now);
  v_current_day integer := EXTRACT(DAY FROM v_now);
  v_site_market_sector text;
  v_site_id uuid;
  v_has_anomalies boolean := false;
  v_gate_score numeric := 0;
BEGIN
  -- Get tracked site info
  SELECT ts.id, ts.market_sector INTO v_site_id, v_site_market_sector
  FROM tracked_sites ts
  WHERE ts.domain = p_domain AND ts.user_id = p_user_id
  LIMIT 1;

  -- Check for active anomalies (last 7 days, severity danger/warning, direction down)
  SELECT EXISTS(
    SELECT 1 FROM anomaly_alerts aa
    WHERE aa.tracked_site_id = v_site_id
      AND aa.detected_at > v_now - interval '7 days'
      AND aa.severity IN ('danger', 'warning')
      AND aa.direction = 'down'
      AND aa.is_dismissed IS NOT TRUE
  ) INTO v_has_anomalies;

  RETURN QUERY
  WITH 
  -- Seasonal boost: check if any seasonal event is active or approaching
  seasonal_boost AS (
    SELECT COALESCE(MAX(
      CASE 
        WHEN sc.impact_level = 'high' THEN 10
        WHEN sc.impact_level = 'medium' THEN 6
        ELSE 3
      END
    ), 0) AS boost
    FROM seasonal_context sc
    WHERE (
      -- Event is currently active
      (sc.start_month < sc.end_month 
        AND v_current_month BETWEEN sc.start_month AND sc.end_month)
      OR (sc.start_month > sc.end_month 
        AND (v_current_month >= sc.start_month OR v_current_month <= sc.end_month))
      OR (sc.start_month = sc.end_month AND v_current_month = sc.start_month)
    )
    AND (sc.sectors IS NULL OR v_site_market_sector = ANY(sc.sectors))
  ),

  -- Anomaly urgency for the site
  anomaly_data AS (
    SELECT 
      COALESCE(MAX(
        CASE 
          WHEN aa.severity = 'danger' THEN 15
          WHEN aa.severity = 'warning' THEN 8
          ELSE 3
        END
      ), 0) AS urgency
    FROM anomaly_alerts aa
    WHERE aa.tracked_site_id = v_site_id
      AND aa.detected_at > v_now - interval '7 days'
      AND aa.direction = 'down'
      AND aa.is_dismissed IS NOT TRUE
  ),

  scored_items AS (
    SELECT
      w.id AS item_id,
      w.title,
      w.finding_category,
      w.action_type::text,
      w.target_url,
      w.severity,
      cd.ring AS item_ring,
      cd.cluster_name,
      cd.maturity_pct AS cluster_maturity,
      
      -- ═══ COMPOSITE SCORE ═══
      (
        -- 1. Ring proximity (0.18) — Ring 1=18, Ring 2=11, Ring 3=5
        (CASE COALESCE(cd.ring, 3)
          WHEN 1 THEN 18
          WHEN 2 THEN 11
          ELSE 5
        END)
        
        -- 2. Cluster maturity GAP (0.18) — Higher gap = higher score
        + (CASE 
          WHEN cd.maturity_pct IS NULL THEN 9
          WHEN cd.maturity_pct < 30 THEN 18
          WHEN cd.maturity_pct < 50 THEN 14
          WHEN cd.maturity_pct < 70 THEN 9
          WHEN cd.maturity_pct < 90 THEN 4
          ELSE 1
        END)
        
        -- 3. Severity pyramid (0.12)
        + (CASE w.severity
          WHEN 'danger' THEN 12
          WHEN 'critical' THEN 12
          WHEN 'warning' THEN 8
          WHEN 'info' THEN 3
          ELSE 5
        END)
        
        -- 4. Anomaly urgency (0.12)
        + LEAST(12, (SELECT urgency FROM anomaly_data))
        
        -- 5. Seasonal boost (0.10)
        + LEAST(10, (SELECT boost FROM seasonal_boost))
        
        -- 6. Velocity decay (0.08)
        + LEAST(8, COALESCE(w.velocity_decay_score, 0) * 0.32)
        
        -- 7. Competitor momentum (0.07)
        + LEAST(7, COALESCE(w.competitor_momentum_score, 0) * 0.35)
        
        -- 8. Keyword coverage gap (0.08) — items with target_url get base score
        + (CASE WHEN w.target_url IS NOT NULL THEN 5 ELSE 2 END)
        
        -- 9. Gate technique (0.07) — penalize if GMB is declining
        + LEAST(7, COALESCE(w.gmb_urgency_score, 0) * 0.35)
      )
      -- Multiply by conversion weight
      * GREATEST(0.5, LEAST(3.0, COALESCE(w.conversion_weight, 1.0)))
      -- Cooldown malus
      - (CASE 
          WHEN w.cooldown_until IS NOT NULL AND w.cooldown_until > v_now 
          THEN 30
          ELSE 0
        END)
      AS computed_score

    FROM architect_workbench w
    LEFT JOIN cluster_definitions cd ON cd.id = w.cluster_id
    WHERE w.domain = p_domain
      AND w.user_id = p_user_id
      AND w.status IN ('pending', 'in_progress', 'assigned')
      -- Lane filter
      AND (
        p_lane = 'all'
        OR (p_lane = 'content' AND (w.action_type = 'content' OR w.action_type IS NULL))
        OR (p_lane = 'code' AND w.action_type = 'code')
      )
      -- Exclude assigned items if requested
      AND (
        NOT p_exclude_assigned 
        OR w.assigned_to IS NULL
      )
  )

  SELECT 
    si.item_id,
    si.title,
    si.finding_category,
    si.action_type,
    si.target_url,
    si.severity,
    GREATEST(0, ROUND(si.computed_score, 2)) AS spiral_score,
    COALESCE(si.item_ring, 3::smallint) AS ring,
    si.cluster_name,
    COALESCE(si.cluster_maturity, 0) AS cluster_maturity
  FROM scored_items si
  ORDER BY si.computed_score DESC
  LIMIT p_limit;
END;
$$;

-- Also create a trigger to update spiral_score on workbench after compute-spiral-signals runs
CREATE OR REPLACE FUNCTION public.update_spiral_score_on_signal_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalculate spiral_score inline when signal columns change
  NEW.spiral_score := (
    -- Simplified inline calculation for storage
    LEAST(8, COALESCE(NEW.velocity_decay_score, 0) * 0.32)
    + LEAST(7, COALESCE(NEW.competitor_momentum_score, 0) * 0.35)
    + LEAST(7, COALESCE(NEW.gmb_urgency_score, 0) * 0.35)
    + (CASE NEW.severity
        WHEN 'danger' THEN 12 WHEN 'critical' THEN 12
        WHEN 'warning' THEN 8 ELSE 5
      END)
  ) * GREATEST(0.5, LEAST(3.0, COALESCE(NEW.conversion_weight, 1.0)));
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_spiral_score ON public.architect_workbench;
CREATE TRIGGER trg_update_spiral_score
  BEFORE UPDATE OF velocity_decay_score, competitor_momentum_score, gmb_urgency_score, conversion_weight
  ON public.architect_workbench
  FOR EACH ROW
  EXECUTE FUNCTION public.update_spiral_score_on_signal_change();
