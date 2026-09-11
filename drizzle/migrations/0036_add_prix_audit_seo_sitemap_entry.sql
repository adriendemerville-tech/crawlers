INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, page_type, is_active)
SELECT 'crawlers.fr', 'https://crawlers.fr/prix-audit-seo', NULL, 'monthly', 0.8, 'static', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.sitemap_entries
  WHERE domain = 'crawlers.fr' AND loc = 'https://crawlers.fr/prix-audit-seo'
);

UPDATE public.sitemap_entries
SET priority = 0.8, changefreq = 'monthly', is_active = true, updated_at = now()
WHERE domain = 'crawlers.fr' AND loc = 'https://crawlers.fr/prix-audit-seo';