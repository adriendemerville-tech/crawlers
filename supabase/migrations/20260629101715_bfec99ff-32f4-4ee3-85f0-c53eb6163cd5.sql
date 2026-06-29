INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, page_type, is_active)
VALUES
  ('crawlers.fr', 'https://crawlers.fr/extension', CURRENT_DATE, 'monthly', 0.6, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/features', CURRENT_DATE, 'monthly', 0.7, 'static', true)
ON CONFLICT (domain, loc) DO UPDATE SET is_active=true, lastmod=EXCLUDED.lastmod;