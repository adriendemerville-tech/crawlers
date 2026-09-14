-- Correctif : les listes d'URLs sont imbriquées dans la charge utile, il faut les aplatir.
CREATE OR REPLACE FUNCTION public.pericles_decision_urls(p_decision_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH linked AS (
    SELECT DISTINCT rtrim(w.target_url, '/') AS url
    FROM architect_workbench w
    WHERE w.pericles_decision_id = p_decision_id AND w.target_url IS NOT NULL
  ),
  payload AS (
    SELECT DISTINCT rtrim(u.value, '/') AS url
    FROM pericles_decision_log d
    CROSS JOIN LATERAL (
      SELECT jsonb_array_elements_text(
        jsonb_path_query_array(d.action_payload, '$.**.affected_urls[*]')
        || jsonb_path_query_array(d.action_payload, '$.**.target_urls[*]')
        || jsonb_path_query_array(d.action_payload, '$.**.target_url')
        || jsonb_path_query_array(COALESCE(d.final_scope, '{}'::jsonb), '$.**.target_urls[*]')
        || jsonb_path_query_array(COALESCE(d.final_scope, '{}'::jsonb), '$.**.target_url')
      ) AS value
    ) u
    WHERE d.id = p_decision_id AND u.value LIKE 'http%'
  )
  SELECT COALESCE(array_agg(DISTINCT url), '{}')
  FROM (SELECT url FROM linked UNION SELECT url FROM payload) s;
$$;

GRANT EXECUTE ON FUNCTION public.pericles_decision_urls(uuid) TO service_role;