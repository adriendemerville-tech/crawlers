UPDATE public.sitemap_entries
SET is_active = false
WHERE domain = 'crawlers.fr'
  AND loc IN (
    'https://crawlers.fr/audit-compare',
    'https://crawlers.fr/site-crawl',
    'https://crawlers.fr/cocoon',
    'https://crawlers.fr/matrice',
    'https://crawlers.fr/cf-shield'
  );