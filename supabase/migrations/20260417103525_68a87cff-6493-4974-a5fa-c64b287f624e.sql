-- Recreate views with security_invoker = true so RLS is enforced as the querying user
DROP VIEW IF EXISTS public.v_ai_attribution_by_url;
DROP VIEW IF EXISTS public.v_ai_attribution_by_source;

CREATE VIEW public.v_ai_attribution_by_url
WITH (security_invoker = true) AS
SELECT
  tracked_site_id,
  user_id,
  domain,
  path,
  COUNT(*) AS visits_30d,
  COUNT(DISTINCT ai_source) AS distinct_sources,
  SUM(attributed_count) AS attributed_crawls,
  MAX(visited_at) AS last_visit_at,
  (
    SELECT ai_source
    FROM public.ai_attribution_events e2
    WHERE e2.tracked_site_id = e1.tracked_site_id
      AND e2.path = e1.path
      AND e2.visited_at > now() - INTERVAL '30 days'
    GROUP BY ai_source
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS top_source,
  (
    SELECT top_attributed_bot
    FROM public.ai_attribution_events e3
    WHERE e3.tracked_site_id = e1.tracked_site_id
      AND e3.path = e1.path
      AND e3.visited_at > now() - INTERVAL '30 days'
      AND e3.top_attributed_bot IS NOT NULL
    GROUP BY top_attributed_bot
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS top_bot
FROM public.ai_attribution_events e1
WHERE visited_at > now() - INTERVAL '30 days'
GROUP BY tracked_site_id, user_id, domain, path;

CREATE VIEW public.v_ai_attribution_by_source
WITH (security_invoker = true) AS
SELECT
  tracked_site_id,
  user_id,
  domain,
  ai_source,
  COUNT(*) AS visits_30d,
  COUNT(DISTINCT path) AS distinct_pages,
  SUM(attributed_count) AS attributed_crawls,
  AVG(total_weight) AS avg_attribution_weight,
  MAX(visited_at) AS last_visit_at
FROM public.ai_attribution_events
WHERE visited_at > now() - INTERVAL '30 days'
GROUP BY tracked_site_id, user_id, domain, ai_source;

COMMENT ON VIEW public.v_ai_attribution_by_url IS
  'Agrégation 30j des visites IA par URL (security_invoker=true, hérite RLS de ai_attribution_events).';

COMMENT ON VIEW public.v_ai_attribution_by_source IS
  'Agrégation 30j des visites IA par source LLM (security_invoker=true, hérite RLS de ai_attribution_events).';