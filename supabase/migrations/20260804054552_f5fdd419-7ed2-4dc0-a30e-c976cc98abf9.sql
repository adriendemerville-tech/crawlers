CREATE OR REPLACE FUNCTION public.match_workbench_cluster(
  p_tracked_site_id uuid,
  p_text text
) RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_toks text[];
  v_id uuid;
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT t
    FROM unnest(regexp_split_to_array(
      lower(regexp_replace(COALESCE(p_text, ''), '[^a-zà-ÿ0-9]+', ' ', 'g')), '\s+')) AS t
    WHERE length(t) >= 4
  ) INTO v_toks;

  IF v_toks IS NULL OR array_length(v_toks, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.id INTO v_id
  FROM (
    SELECT cd.id, cd.ring,
      (SELECT COUNT(DISTINCT kt) FROM unnest(COALESCE(cd.keywords, ARRAY[]::text[])) AS k,
        unnest(regexp_split_to_array(lower(regexp_replace(k, '[^a-zà-ÿ0-9]+', ' ', 'g')), '\s+')) AS kt
        WHERE length(kt) >= 4 AND kt = ANY(v_toks)) AS overlap,
      (SELECT MAX(length(kt)) FROM unnest(COALESCE(cd.keywords, ARRAY[]::text[])) AS k,
        unnest(regexp_split_to_array(lower(regexp_replace(k, '[^a-zà-ÿ0-9]+', ' ', 'g')), '\s+')) AS kt
        WHERE length(kt) >= 4 AND kt = ANY(v_toks)) AS best_len
    FROM cluster_definitions cd
    WHERE cd.tracked_site_id = p_tracked_site_id
  ) s
  WHERE s.overlap >= 2 OR (s.overlap = 1 AND s.best_len >= 8)
  ORDER BY s.overlap DESC, s.best_len DESC, s.ring ASC
  LIMIT 1;

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.match_workbench_cluster(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.match_workbench_cluster(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_assign_workbench_cluster()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $tg$
BEGIN
  IF NEW.cluster_id IS NULL
     AND NEW.tracked_site_id IS NOT NULL
     AND COALESCE(NEW.finding_category, '') NOT IN (
       'accessibility','security','http_errors','index_bloat','speed','core_web_vitals',
       'broken_links','canonical','redirect_chain','crawl_errors','robots','sitemap',
       'mobile','orphan_pages','structured_data','meta_tags','technical_fix'
     )
  THEN
    NEW.cluster_id := public.match_workbench_cluster(
      NEW.tracked_site_id,
      COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.target_url, '')
    );
  END IF;
  RETURN NEW;
END;
$tg$;

REVOKE ALL ON FUNCTION public.tg_assign_workbench_cluster() FROM anon, authenticated, public;

UPDATE public.architect_workbench w
SET cluster_id = public.match_workbench_cluster(
      w.tracked_site_id,
      COALESCE(w.title, '') || ' ' || COALESCE(w.description, '') || ' ' || COALESCE(w.target_url, '')
    )
WHERE w.cluster_id IS NULL
  AND w.tracked_site_id IS NOT NULL
  AND COALESCE(w.finding_category, '') NOT IN (
    'accessibility','security','http_errors','index_bloat','speed','core_web_vitals',
    'broken_links','canonical','redirect_chain','crawl_errors','robots','sitemap',
    'mobile','orphan_pages','structured_data','meta_tags','technical_fix'
  );