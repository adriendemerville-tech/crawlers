-- Mesure déterministe du signal de récompense depuis les données GSC réelles.
-- Sans cette fonction, reward_signal restait vide (aucun snapshot d'impact n'existe),
-- donc la boucle récursive n'avait rien à réinjecter.
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
    v_pos_delta := v_after.position - v_base.position; -- négatif = amélioration

    -- Mêmes pondérations que la boucle applicative : 40% clics, 25% position, 20% CTR, 15% impressions
    v_reward :=
      GREATEST(-25, LEAST(25, v_clicks_delta * 0.5)) * 0.40
      + GREATEST(-25, LEAST(25, -v_pos_delta * 3)) * 0.25
      + GREATEST(-25, LEAST(25, v_ctr_delta * 0.8)) * 0.20
      + GREATEST(-25, LEAST(25, v_impr_delta * 0.3)) * 0.15;

    -- Pénalité de sur-priorisation : score élevé mais résultat négatif
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

COMMENT ON FUNCTION public.pericles_measure_rewards(text, integer, integer) IS 'Calcule le signal de récompense (-100..+100) de chaque décision exécutée en comparant les fenêtres GSC avant/après. Alimente score_spiral_priority et pericles_reward_health.';