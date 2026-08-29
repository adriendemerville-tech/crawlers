INSERT INTO public.sitemap_entries (domain, loc, changefreq, priority, page_type, is_active) VALUES
  ('crawlers.fr', 'https://crawlers.fr/api-integrations', 'monthly', 0.6, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/indice-alignement-strategique', 'monthly', 0.7, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/integration-gtm', 'monthly', 0.5, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/sea-seo-bridge', 'monthly', 0.6, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/machine-layer-scanner', 'monthly', 0.7, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/social-content-creator', 'monthly', 0.6, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/stratege-cocoon', 'monthly', 0.6, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/content-architect', 'monthly', 0.6, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/conversion-optimizer', 'monthly', 0.6, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/cgvu', 'yearly', 0.2, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/conditions-utilisation', 'yearly', 0.2, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/mentions-legales', 'yearly', 0.2, 'static', true),
  ('crawlers.fr', 'https://crawlers.fr/blog/audit-seo-gratuit-vs-semrush', 'monthly', 0.7, 'article', true),
  ('crawlers.fr', 'https://crawlers.fr/blog/mission-mise-aux-normes-ia', 'monthly', 0.7, 'article', true),
  ('crawlers.fr', 'https://crawlers.fr/blog/reddit-tromper-bots-ia-seo-geo', 'monthly', 0.7, 'article', true),
  ('crawlers.fr', 'https://crawlers.fr/blog/tableau-comparatif-seo-geo-2026', 'monthly', 0.7, 'article', true)
ON CONFLICT (domain, loc) DO UPDATE SET is_active = true, changefreq = EXCLUDED.changefreq, priority = EXCLUDED.priority, updated_at = now();