-- 1) Réconciliation globale des décisions Parménion restées 'planned' (cycles interrompus)
CREATE OR REPLACE FUNCTION public.reconcile_stale_parmenion_decisions(p_hours integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE parmenion_decision_log
    SET status = 'skipped_stale',
        execution_error = COALESCE(execution_error, 'Cycle interrompu (timeout) — réconciliation globale'),
        updated_at = now()
    WHERE status = 'planned'
      AND created_at < now() - make_interval(hours => GREATEST(1, p_hours))
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_stale_parmenion_decisions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_stale_parmenion_decisions(integer) TO service_role;

-- 2) Nouvelle tentative de rattachement de cluster pour les items contenu non rattachés
CREATE OR REPLACE FUNCTION public.retry_workbench_cluster_assignment(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
  v_cluster uuid;
BEGIN
  FOR r IN
    SELECT id, tracked_site_id, title, description, target_url
    FROM architect_workbench
    WHERE cluster_id IS NULL
      AND tracked_site_id IS NOT NULL
      AND status IN ('pending', 'in_progress')
      AND COALESCE(finding_category, '') NOT IN (
        'accessibility','security','http_errors','index_bloat','speed','core_web_vitals',
        'broken_links','canonical','redirect_chain','crawl_errors','robots','sitemap',
        'mobile','orphan_pages','structured_data','meta_tags','technical_fix'
      )
    ORDER BY created_at DESC
    LIMIT GREATEST(1, p_limit)
  LOOP
    v_cluster := public.match_workbench_cluster(
      r.tracked_site_id,
      COALESCE(r.title, '') || ' ' || COALESCE(r.description, '') || ' ' || COALESCE(r.target_url, '')
    );
    IF v_cluster IS NOT NULL THEN
      UPDATE architect_workbench SET cluster_id = v_cluster, updated_at = now() WHERE id = r.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_workbench_cluster_assignment(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_workbench_cluster_assignment(integer) TO service_role;

-- 3) Crons SQL-only
SELECT cron.unschedule('reconcile-stale-parmenion-hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-stale-parmenion-hourly');
SELECT cron.schedule('reconcile-stale-parmenion-hourly', '25 * * * *', $$SELECT public.reconcile_stale_parmenion_decisions(3);$$);

SELECT cron.unschedule('retry-workbench-cluster-6h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-workbench-cluster-6h');
SELECT cron.schedule('retry-workbench-cluster-6h', '5 */6 * * *', $$SELECT public.retry_workbench_cluster_assignment(500);$$);