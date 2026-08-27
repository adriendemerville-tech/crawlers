CREATE OR REPLACE FUNCTION public.get_audited_domains_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::integer FROM (
    SELECT DISTINCT lower(regexp_replace(d, '^www\.', '')) AS dom
    FROM (
      SELECT domain AS d FROM public.audits
      UNION ALL SELECT domain FROM public.analyzed_urls
      UNION ALL SELECT domain FROM public.crawl_jobs
      UNION ALL SELECT domain FROM public.competitor_matrix_jobs
      UNION ALL SELECT domain FROM public.tracked_sites
      UNION ALL SELECT domain FROM public.external_audits
      UNION ALL SELECT domain FROM public.geo_visibility_snapshots
      UNION ALL SELECT domain FROM public.audit_matrix_sessions
      UNION ALL SELECT domain FROM public.matrix_audit_sessions
    ) s
    WHERE d IS NOT NULL AND d <> ''
  ) u;
$function$;