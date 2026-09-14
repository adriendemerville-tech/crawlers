-- Périmètre de mesure d'une décision : requêtes GSC réellement rattachables aux pages visées.
-- Deux sources déterministes, sans LLM : les mots-clés déclarés (keyword_universe)
-- et les requêtes GSC contenant un segment significatif du slug de la page.
CREATE OR REPLACE FUNCTION public.pericles_decision_queries(p_decision_id uuid, p_domain text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH urls AS (
    SELECT unnest(public.pericles_decision_urls(p_decision_id)) AS url
  ),
  declared AS (
    SELECT DISTINCT lower(COALESCE(k.keyword_normalized, k.keyword)) AS q
    FROM keyword_universe k JOIN urls u ON rtrim(k.target_url, '/') = u.url
    WHERE k.domain = p_domain
  ),
  tokens AS (
    SELECT DISTINCT t.tok
    FROM urls u
    CROSS JOIN LATERAL regexp_split_to_table(
      lower(regexp_replace(u.url, '^https?://[^/]+/?', '')), '[^a-z0-9]+') AS t(tok)
    WHERE length(t.tok) >= 5
      AND t.tok NOT IN ('lexique','blog','guide','docs','page','pages','index','html','www','crawlers')
  ),
  matched AS (
    SELECT DISTINCT lower(g.query) AS q
    FROM gsc_daily_positions g JOIN tokens t ON lower(g.query) LIKE '%' || t.tok || '%'
    WHERE g.domain = p_domain
  )
  SELECT COALESCE(array_agg(DISTINCT q), '{}') FROM (
    SELECT q FROM declared UNION SELECT q FROM matched
  ) s;
$$;

GRANT EXECUTE ON FUNCTION public.pericles_decision_queries(uuid, text) TO service_role;