ALTER TABLE public.sitemap_entries ALTER COLUMN lastmod DROP NOT NULL;

UPDATE public.sitemap_entries SET is_active = false, updated_at = now()
WHERE domain = 'crawlers.fr' AND is_active
  AND page_type NOT IN ('blog','guide')
  AND replace(loc, 'https://crawlers.fr', '') NOT IN ('/','/a-propos','/aide','/analyse-bots-ia','/analyse-logs','/analyse-site-web-gratuit','/architecte-generatif','/audit-expert','/audit-semantique','/audit-seo-geo','/audit-seo-gratuit','/auteur','/auteur/adrien-de-volontat','/blog','/breathing-spiral','/comparatif-claude-vs-crawlers','/comparatif-crawlers-ahrefs','/comparatif-crawlers-screaming-frog','/comparatif-crawlers-semrush','/comparatif-plateforme-seo-ia','/crawl','/developers','/developers/aide-facturation','/developers/docs','/developers/sdks','/docs/api/crawlers','/docs/api/marina','/docs/api/parmenion','/eeat','/etudes/autopilot-parmenion-iktracker','/etudes/cout-reponse-chatgpt-vs-google-ads','/extension','/faq','/features/cocoon','/generative-engine-optimization','/google-business','/guide-audit-seo','/guides','/lexique','/lexique/aeo-answer-engine-optimization','/lexique/b2b-business-to-business','/lexique/behavioral-analysis','/lexique/canvas-fingerprinting','/lexique/chunkability-score','/lexique/concurrency-control','/lexique/crawl-budget','/lexique/cro-conversion-rate-optimization','/lexique/cta-call-to-action','/lexique/ctr-gap','/lexique/data-normalization','/lexique/dom-parsing','/lexique/drop-detector','/lexique/ethical-scraping','/lexique/etv-estimated-traffic-value','/lexique/fair-use-quotas','/lexique/headless-browsing','/lexique/http2-http3','/lexique/identity-card','/lexique/ip-rotation-proxies','/lexique/ja3-ja3s','/lexique/kpi-indicateur-cle','/lexique/llm-based-parsing','/lexique/marina-prospection','/lexique/observatoire-sectoriel','/lexique/position-zero','/lexique/query-fan-out','/lexique/quotability-index','/lexique/rag','/lexique/rgpd-protection-donnees','/lexique/robots-txt-interpretation','/lexique/roi-retour-investissement','/lexique/saas-software-as-a-service','/lexique/schema-org-extraction','/lexique/sea-search-engine-advertising','/lexique/self-healing-scrapers','/lexique/shadow-dom','/lexique/smart-recommendations','/lexique/spo-score','/lexique/ssr-vs-csr','/lexique/tls-fingerprinting','/lexique/user-agent-spoofing','/lexique/voice-dna','/marina','/methodologie','/modifier-code-wordpress','/monitoring-gptbot-perplexity','/observatoire','/pagespeed','/pro-agency','/tarifs');

WITH candidates(domain, loc, lastmod, changefreq, priority, page_type, is_active) AS (
  VALUES
    ('crawlers.fr','https://crawlers.fr/',NULL,'daily',1.0,'static',true),
    ('crawlers.fr','https://crawlers.fr/audit-seo-geo',NULL,'weekly',0.8,'landing',true),
    ('crawlers.fr','https://crawlers.fr/auteur',NULL,'monthly',0.6,'static',true),
    ('crawlers.fr','https://crawlers.fr/auteur/adrien-de-volontat',NULL,'monthly',0.6,'static',true),
    ('crawlers.fr','https://crawlers.fr/breathing-spiral',NULL,'monthly',0.6,'static',true),
    ('crawlers.fr','https://crawlers.fr/comparatif-plateforme-seo-ia',NULL,'weekly',0.8,'landing',true),
    ('crawlers.fr','https://crawlers.fr/developers',NULL,'monthly',0.5,'static',true),
    ('crawlers.fr','https://crawlers.fr/developers/aide-facturation',NULL,'monthly',0.5,'static',true),
    ('crawlers.fr','https://crawlers.fr/developers/docs',NULL,'monthly',0.5,'static',true),
    ('crawlers.fr','https://crawlers.fr/developers/sdks',NULL,'monthly',0.5,'static',true),
    ('crawlers.fr','https://crawlers.fr/docs/api/crawlers',NULL,'monthly',0.5,'static',true),
    ('crawlers.fr','https://crawlers.fr/docs/api/marina',NULL,'monthly',0.5,'static',true),
    ('crawlers.fr','https://crawlers.fr/docs/api/parmenion',NULL,'monthly',0.5,'static',true),
    ('crawlers.fr','https://crawlers.fr/etudes/autopilot-parmenion-iktracker',NULL,'monthly',0.6,'landing',true),
    ('crawlers.fr','https://crawlers.fr/etudes/cout-reponse-chatgpt-vs-google-ads',NULL,'monthly',0.6,'landing',true),
    ('crawlers.fr','https://crawlers.fr/features/cocoon',NULL,'monthly',0.6,'static',true),
    ('crawlers.fr','https://crawlers.fr/monitoring-gptbot-perplexity',NULL,'weekly',0.8,'landing',true),
    ('crawlers.fr','https://crawlers.fr/lexique/quotability-index',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/position-zero',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/query-fan-out',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/chunkability-score',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/spo-score',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/etv-estimated-traffic-value',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/voice-dna',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/marina-prospection',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/drop-detector',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/observatoire-sectoriel',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/identity-card',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/fair-use-quotas',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/smart-recommendations',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/ctr-gap',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/cro-conversion-rate-optimization',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/sea-search-engine-advertising',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/kpi-indicateur-cle',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/roi-retour-investissement',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/cta-call-to-action',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/b2b-business-to-business',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/saas-software-as-a-service',NULL,'monthly',0.4,'lexique',true),
    ('crawlers.fr','https://crawlers.fr/lexique/rgpd-protection-donnees',NULL,'monthly',0.4,'lexique',true)
)
INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, page_type, is_active)
SELECT c.domain, c.loc, c.lastmod::date, c.changefreq, c.priority::numeric, c.page_type, c.is_active
FROM candidates c
WHERE NOT EXISTS (
  SELECT 1 FROM public.sitemap_entries s WHERE s.domain = c.domain AND s.loc = c.loc
);

UPDATE public.sitemap_entries SET is_active = true, updated_at = now()
WHERE domain='crawlers.fr' AND NOT is_active
  AND replace(loc,'https://crawlers.fr','') IN ('/','/analyse-logs','/audit-seo-geo','/auteur','/auteur/adrien-de-volontat','/breathing-spiral','/comparatif-plateforme-seo-ia','/features/cocoon','/modifier-code-wordpress','/monitoring-gptbot-perplexity');

UPDATE public.sitemap_entries SET lastmod = NULL
WHERE domain='crawlers.fr' AND loc='https://crawlers.fr/comparatif-crawlers-screaming-frog';