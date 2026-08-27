UPDATE public.sitemap_entries SET is_active = true, updated_at = now()
WHERE domain = 'crawlers.fr'
  AND loc IN ('https://crawlers.fr/contact','https://crawlers.fr/politique-confidentialite');

INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, page_type, is_active)
VALUES
  ('crawlers.fr','https://crawlers.fr/marketplace-backlinks', NULL, 'weekly', 0.7, 'static', true),
  ('crawlers.fr','https://crawlers.fr/collab-instagram', NULL, 'weekly', 0.7, 'static', true)
ON CONFLICT DO NOTHING;