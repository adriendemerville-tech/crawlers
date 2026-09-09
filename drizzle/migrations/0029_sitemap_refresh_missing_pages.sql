INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, page_type, is_active)
VALUES
  ('crawlers.fr', 'https://crawlers.fr/rgpd',           NULL, 'yearly',  0.4, 'static',  true),
  ('crawlers.fr', 'https://crawlers.fr/cf-shield',      NULL, 'monthly', 0.6, 'landing', true),
  ('crawlers.fr', 'https://crawlers.fr/diagnostic-waf', NULL, 'monthly', 0.6, 'landing', true)
ON CONFLICT (domain, loc) DO UPDATE
  SET is_active  = true,
      changefreq = EXCLUDED.changefreq,
      priority   = EXCLUDED.priority,
      page_type  = EXCLUDED.page_type;

UPDATE public.sitemap_entries
   SET is_active = false
 WHERE domain = 'crawlers.fr'
   AND loc = 'https://crawlers.fr/app/ranking-serp';