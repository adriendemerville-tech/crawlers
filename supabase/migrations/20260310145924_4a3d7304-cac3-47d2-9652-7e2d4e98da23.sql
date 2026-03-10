CREATE OR REPLACE FUNCTION public.upsert_analyzed_url(p_url text, p_domain text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO analyzed_urls (url, domain, analysis_count, last_analyzed_at)
  VALUES (p_url, p_domain, 1, now())
  ON CONFLICT (url) DO UPDATE SET
    analysis_count = analyzed_urls.analysis_count + 1,
    last_analyzed_at = now();
END;
$$;