-- Guides métier livrés dans le dépôt (/guide/artisan-seo, ecommerce, agence, saas).
-- lastmod reste vide : pas de date de fraîcheur inventée.
INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, page_type, is_active)
VALUES
  ('crawlers.fr', 'https://crawlers.fr/guide/artisan-seo', NULL, 'monthly', 0.7, 'guide', true),
  ('crawlers.fr', 'https://crawlers.fr/guide/ecommerce-seo', NULL, 'monthly', 0.7, 'guide', true),
  ('crawlers.fr', 'https://crawlers.fr/guide/agence-seo', NULL, 'monthly', 0.7, 'guide', true),
  ('crawlers.fr', 'https://crawlers.fr/guide/saas-seo', NULL, 'monthly', 0.7, 'guide', true)
ON CONFLICT (domain, loc) DO UPDATE
SET is_active = true,
    changefreq = EXCLUDED.changefreq,
    priority = EXCLUDED.priority,
    page_type = EXCLUDED.page_type,
    updated_at = now();
