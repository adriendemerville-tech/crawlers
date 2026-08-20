UPDATE public.sitemap_entries SET is_active = false, updated_at = now()
WHERE loc ~ '/(score-geo|outil-geo-ia|visibilite-llm|optimisation-llm-seo|referencement-ia|crawler-ia|cocoon|site-crawl)/?$';