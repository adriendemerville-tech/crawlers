update public.tracked_sites
set market_sector = 'Services web, SEO et numérique',
    products_services = 'SaaS d''audit et d''optimisation SEO, GEO et AEO : audit de sites, visibilité dans les moteurs de réponse IA, correction et création de contenus automatisées',
    target_audience = 'Freelances SEO, agences SEO, services marketing de PME',
    commercial_model = 'saas',
    entity_type = 'saas',
    is_local_business = false,
    identity_source = 'user_manual',
    identity_confidence = 95,
    identity_enriched_at = now()
where domain = 'crawlers.fr';