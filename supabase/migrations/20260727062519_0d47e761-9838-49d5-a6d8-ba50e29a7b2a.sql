
UPDATE public.sitemap_entries s
SET lastmod = GREATEST(b.updated_at, COALESCE(b.published_at, b.updated_at))::date
FROM public.blog_articles b
WHERE s.domain = 'crawlers.fr'
  AND s.loc = 'https://crawlers.fr/blog/' || b.slug;

UPDATE public.sitemap_entries s
SET lastmod = GREATEST(d.updated_at, COALESCE(d.published_at, d.updated_at))::date
FROM public.seo_page_drafts d
WHERE s.domain = 'crawlers.fr'
  AND d.status IN ('published','live','approved')
  AND (
    s.loc = 'https://crawlers.fr/' || d.slug
    OR s.loc = 'https://crawlers.fr' || d.slug
  );

UPDATE public.sitemap_entries
SET priority = CASE
  WHEN loc = 'https://crawlers.fr' OR loc = 'https://crawlers.fr/' THEN 1.0
  WHEN loc IN (
    'https://crawlers.fr/tarifs',
    'https://crawlers.fr/audit-expert',
    'https://crawlers.fr/audit-compare',
    'https://crawlers.fr/audit-seo-gratuit',
    'https://crawlers.fr/analyse-site-web-gratuit'
  ) THEN 0.9
  WHEN loc IN (
    'https://crawlers.fr/blog',
    'https://crawlers.fr/guides',
    'https://crawlers.fr/features',
    'https://crawlers.fr/lexique',
    'https://crawlers.fr/observatoire'
  ) THEN 0.9
  WHEN loc LIKE 'https://crawlers.fr/audit-seo-geo%'
    OR loc LIKE 'https://crawlers.fr/outil-geo-ia%'
    OR loc LIKE 'https://crawlers.fr/optimisation-llm-seo%'
    OR loc LIKE 'https://crawlers.fr/crawler-ia%'
    OR loc LIKE 'https://crawlers.fr/monitoring-gptbot-perplexity%'
    OR loc LIKE 'https://crawlers.fr/generative-engine-optimization%'
    OR loc LIKE 'https://crawlers.fr/comparatif-%'
    THEN 0.8
  WHEN loc LIKE 'https://crawlers.fr/guide/%' THEN 0.7
  WHEN loc LIKE 'https://crawlers.fr/features/%'
    OR loc IN (
      'https://crawlers.fr/cocoon',
      'https://crawlers.fr/content-architect',
      'https://crawlers.fr/conversion-optimizer',
      'https://crawlers.fr/eeat',
      'https://crawlers.fr/matrice',
      'https://crawlers.fr/marina',
      'https://crawlers.fr/architecte-generatif',
      'https://crawlers.fr/site-crawl',
      'https://crawlers.fr/analyse-bots-ia',
      'https://crawlers.fr/analyse-logs',
      'https://crawlers.fr/audit-semantique',
      'https://crawlers.fr/google-business',
      'https://crawlers.fr/indice-alignement-strategique',
      'https://crawlers.fr/pagespeed',
      'https://crawlers.fr/methodologie',
      'https://crawlers.fr/guide-audit-seo'
    ) THEN 0.7
  WHEN loc LIKE 'https://crawlers.fr/blog/%' THEN 0.6
  WHEN loc LIKE 'https://crawlers.fr/etudes/%' THEN 0.7
  WHEN loc LIKE 'https://crawlers.fr/auteur%' THEN 0.6
  WHEN loc IN (
    'https://crawlers.fr/contact',
    'https://crawlers.fr/faq',
    'https://crawlers.fr/extension',
    'https://crawlers.fr/integration-gtm',
    'https://crawlers.fr/modifier-code-wordpress'
  ) THEN 0.5
  WHEN loc LIKE 'https://crawlers.fr/lexique/%' THEN 0.4
  WHEN loc IN (
    'https://crawlers.fr/mentions-legales',
    'https://crawlers.fr/conditions-utilisation',
    'https://crawlers.fr/rgpd',
    'https://crawlers.fr/politique-confidentialite'
  ) THEN 0.3
  ELSE COALESCE(priority, 0.5)
END,
changefreq = CASE
  WHEN loc = 'https://crawlers.fr' THEN 'daily'
  WHEN loc IN ('https://crawlers.fr/blog','https://crawlers.fr/observatoire') THEN 'daily'
  WHEN loc LIKE 'https://crawlers.fr/blog/%' THEN 'monthly'
  WHEN loc LIKE 'https://crawlers.fr/lexique/%' THEN 'yearly'
  WHEN loc IN ('https://crawlers.fr/mentions-legales','https://crawlers.fr/conditions-utilisation','https://crawlers.fr/rgpd','https://crawlers.fr/politique-confidentialite') THEN 'yearly'
  WHEN loc LIKE 'https://crawlers.fr/guide/%' THEN 'monthly'
  WHEN loc LIKE 'https://crawlers.fr/etudes/%' THEN 'monthly'
  ELSE COALESCE(changefreq, 'weekly')
END
WHERE domain = 'crawlers.fr' AND is_active = true;

UPDATE public.sitemap_entries
SET lastmod = COALESCE(updated_at, now())::date
WHERE domain = 'crawlers.fr'
  AND is_active = true
  AND lastmod IN ('2025-06-01'::date,'2025-01-01'::date)
  AND updated_at IS NOT NULL
  AND updated_at::date > '2025-06-01'::date;
