-- Compteur public : nombre de noms de domaine distincts réellement audités.
-- SECURITY DEFINER volontaire : les tables sources sont protégées par RLS, mais
-- l'agrégat (un simple entier, aucune donnée client) doit rester lisible sans
-- compte pour la preuve sociale affichée sur les pages publiques.
CREATE OR REPLACE FUNCTION public.get_audited_domains_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM (
    SELECT DISTINCT lower(regexp_replace(domain, '^www\.', '')) AS d
    FROM (
      SELECT domain FROM public.audits WHERE domain IS NOT NULL AND domain <> ''
      UNION ALL
      SELECT domain FROM public.analyzed_urls WHERE domain IS NOT NULL AND domain <> ''
      UNION ALL
      SELECT domain FROM public.crawl_jobs WHERE domain IS NOT NULL AND domain <> ''
      UNION ALL
      SELECT domain FROM public.competitor_matrix_jobs WHERE domain IS NOT NULL AND domain <> ''
    ) s
  ) u;
$$;

REVOKE ALL ON FUNCTION public.get_audited_domains_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_audited_domains_count() TO anon, authenticated, service_role;