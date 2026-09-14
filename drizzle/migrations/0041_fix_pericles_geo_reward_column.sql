-- Correctif : la colonne de score des relevés IA s'appelle overall_score (et non geo_score).
-- Le delta est mesuré par rapport au relevé précédent du même domaine, borné -6/+6.
CREATE OR REPLACE FUNCTION public.pericles_geo_reward(p_decision_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT GREATEST(-6, LEAST(6, ROUND(
    AVG(COALESCE(gv.delta_overall_score, 0))::numeric / 5, 2)))
  FROM geo_visibility_snapshots gv
  WHERE gv.pericles_decision_id = p_decision_id;
$$;

GRANT EXECUTE ON FUNCTION public.pericles_geo_reward(uuid) TO service_role;
