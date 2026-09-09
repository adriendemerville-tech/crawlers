-- /audit-geo-seo devient la tête du silo GEO : priorité sitemap la plus haute
-- après la home. lastmod reste NULL (pas de date de modification réelle ici).

INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, page_type, is_active)
SELECT 'crawlers.fr', 'https://crawlers.fr/audit-geo-seo', NULL, 'weekly', 0.95, 'static', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.sitemap_entries
  WHERE domain = 'crawlers.fr' AND loc = 'https://crawlers.fr/audit-geo-seo'
);

UPDATE public.sitemap_entries
SET priority = 0.95, changefreq = 'weekly', is_active = true, updated_at = now()
WHERE domain = 'crawlers.fr' AND loc = 'https://crawlers.fr/audit-geo-seo';

UPDATE public.sitemap_entries
SET priority = 0.8, updated_at = now()
WHERE domain = 'crawlers.fr'
  AND loc IN (
    'https://crawlers.fr/generative-engine-optimization',
    'https://crawlers.fr/audit-geo'
  );

UPDATE public.sitemap_entries
SET priority = 0.7, updated_at = now()
WHERE domain = 'crawlers.fr'
  AND loc IN (
    'https://crawlers.fr/audit-seo-geo',
    'https://crawlers.fr/visibilite-ia',
    'https://crawlers.fr/audit-seo-par-ia'
  );