-- Le trigger écrasait le spiral_score 10-signaux calculé par compute-spiral-signals
-- par une formule simplifiée à 4 signaux (sans ring, maturité, saisonnalité,
-- couverture ni malus de saturation) → la Breathing Spiral devenait inerte.
-- Désormais : si l'appelant fournit explicitement un spiral_score, on le respecte ;
-- sinon on calcule un score de repli aligné sur la formule complète.
CREATE OR REPLACE FUNCTION public.update_spiral_score_on_signal_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_maturity_points numeric;
BEGIN
  -- Score fourni explicitement (compute-spiral-signals) : ne pas l'écraser
  IF TG_OP = 'UPDATE'
     AND NEW.spiral_score IS NOT NULL
     AND NEW.spiral_score IS DISTINCT FROM OLD.spiral_score THEN
    RETURN NEW;
  END IF;

  -- Absence de cluster = neutralité (7 pts sur 15), pas de bonus maximal
  v_maturity_points := CASE
    WHEN NEW.cluster_maturity_pct IS NULL THEN 7
    ELSE ((100 - LEAST(100, GREATEST(0, NEW.cluster_maturity_pct))) / 100.0) * 15
  END;

  NEW.spiral_score := LEAST(100, GREATEST(0, ROUND(
      COALESCE(NEW.velocity_decay_score, 0) * 1.6
    + COALESCE(NEW.competitor_momentum_score, 0) * 0.8
    + v_maturity_points
    + COALESCE(NEW.gmb_urgency_score, 0) * 0.6
    + COALESCE(NEW.conversion_weight, 0) * 10
    + COALESCE(NEW.ring_proximity_score, 0)
    + COALESCE(NEW.anomaly_urgency_score, 0)
    + COALESCE(NEW.seasonal_boost_score, 0)
    + COALESCE(NEW.keyword_coverage_score, 0)
  )));

  RETURN NEW;
END;
$function$;