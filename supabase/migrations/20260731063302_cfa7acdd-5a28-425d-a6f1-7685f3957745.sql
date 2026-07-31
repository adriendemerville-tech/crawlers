UPDATE public.linkedin_features_catalog SET capture_route = v.route
FROM (VALUES
  ('geo-bot-attribution', 'https://crawlers.fr/app/console?tab=geo'),
  ('autopilot-parmenion', 'https://crawlers.fr/app/console?tab=action-plans'),
  ('strategic-audit', 'https://crawlers.fr/audit-expert'),
  ('content-architect', 'https://crawlers.fr/app/console?tab=drafts'),
  ('cocoon-3d', 'https://crawlers.fr/app/cocoon'),
  ('drop-detector', 'https://crawlers.fr/app/console?tab=tracking'),
  ('copilot-market', 'https://crawlers.fr/app/copilot'),
  ('sea-seo-bridge', 'https://crawlers.fr/app/console?tab=sea-seo'),
  ('serp-benchmark', 'https://crawlers.fr/app/ranking-serp'),
  ('breathing-spiral', 'https://crawlers.fr/breathing-spiral'),
  ('ias-strategic-index', 'https://crawlers.fr/app/console?tab=tracking'),
  ('shield-cloudflare', 'https://crawlers.fr/cf-shield'),
  ('eeat-scoring', 'https://crawlers.fr/app/eeat'),
  ('crawlers-api', 'https://crawlers.fr/developers'),
  ('marina-outreach', 'https://crawlers.fr/app/console?tab=marina')
) AS v(slug, route)
WHERE linkedin_features_catalog.slug = v.slug;