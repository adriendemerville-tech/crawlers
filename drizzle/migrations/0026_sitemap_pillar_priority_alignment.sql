-- Les 4 têtes de silo partagent la même priorité (0.9)
UPDATE public.sitemap_entries
SET priority = 0.9, changefreq = 'weekly', is_active = true, updated_at = now()
WHERE loc IN (
  'https://crawlers.fr/audit-geo-seo',
  'https://crawlers.fr/crawl',
  'https://crawlers.fr/comparatif-crawlers-semrush',
  'https://crawlers.fr/blog/crawler-definition-seo-geo'
);

-- Satellites qui ne doivent pas égaler leurs piliers
UPDATE public.sitemap_entries
SET priority = 0.8, updated_at = now()
WHERE loc IN (
  'https://crawlers.fr/audit-expert',
  'https://crawlers.fr/matrice-concurrence'
);
