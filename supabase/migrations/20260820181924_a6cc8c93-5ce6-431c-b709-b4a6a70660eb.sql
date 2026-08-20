INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, is_active)
VALUES
  ('crawlers.fr', 'https://crawlers.fr/crawl', now(), 'weekly', 0.9, true),
  ('crawlers.fr', 'https://crawlers.fr/comparatif-crawlers-ahrefs', now(), 'monthly', 0.8, true)
ON CONFLICT (domain, loc) DO UPDATE
  SET is_active = true, lastmod = now(), changefreq = EXCLUDED.changefreq, priority = EXCLUDED.priority;