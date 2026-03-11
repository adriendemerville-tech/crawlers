
CREATE OR REPLACE FUNCTION public.upsert_analyzed_url(p_url text, p_domain text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_normalized_url text;
  v_normalized_domain text;
BEGIN
  v_normalized_url := rtrim(lower(p_url), '/');
  v_normalized_domain := lower(p_domain);

  INSERT INTO analyzed_urls (url, domain, analysis_count, last_analyzed_at)
  VALUES (v_normalized_url, v_normalized_domain, 1, now())
  ON CONFLICT (url) DO UPDATE SET
    analysis_count = analyzed_urls.analysis_count + 1,
    last_analyzed_at = now();
END;
$function$;
