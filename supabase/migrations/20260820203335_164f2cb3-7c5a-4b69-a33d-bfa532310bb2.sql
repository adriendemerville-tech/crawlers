-- 1. Le pilier reçoit un slug propre et un titre court
UPDATE public.blog_articles
SET slug = 'front-loading-title-mot-cle-premier-mot',
    title = 'Front-loading title : le mot-clé en tête',
    excerpt = 'Pourquoi placer le mot-clé principal dans les premiers mots de la balise title reste un signal fort en SEO comme en GEO, et comment arbitrer avec le CTR.'
WHERE slug = 'front-loading-semantique-pourquoi-placer-votre-mot-cle-en-tete-de-title-est-vita';

-- 2. Les quasi-doublons sont dépubliés (redirection 301 côté application)
UPDATE public.blog_articles
SET status = 'unpublished'
WHERE slug IN (
  'front-loading-seo-maximiser-le-poids-semantique-du-premier-mot-de-votre-balise-t',
  'optimiser-la-balise-title-pour-le-double-impact-algorithmes-google-et-moteurs-ia',
  'optimiser-sa-balise-title-l-impact-strategique-du-premier-mot-en-2026',
  'front-loading-strategique-positionner-votre-mot-cle-en-debut-de-title-pour-domin',
  'la-regle-du-premier-mot-optimiser-l-emplacement-de-ses-mots-cles-dans-le-title-p',
  'la-methode-du-front-loading-pourquoi-placer-votre-mot-cle-des-le-premier-mot-de-',
  'le-dilemme-du-premier-mot-optimiser-la-position-des-mots-cles-dans-la-balise-tit'
);

-- 3. Sitemap : désactiver les URLs redirigées, publier le pilier
UPDATE public.sitemap_entries
SET is_active = false
WHERE loc LIKE '%/blog/front-loading-seo-maximiser%'
   OR loc LIKE '%/blog/optimiser-la-balise-title-pour-le-double-impact%'
   OR loc LIKE '%/blog/optimiser-sa-balise-title-l-impact%'
   OR loc LIKE '%/blog/front-loading-strategique%'
   OR loc LIKE '%/blog/la-regle-du-premier-mot%'
   OR loc LIKE '%/blog/la-methode-du-front-loading%'
   OR loc LIKE '%/blog/le-dilemme-du-premier-mot%'
   OR loc LIKE '%/blog/front-loading-semantique%';

INSERT INTO public.sitemap_entries (loc, page_type, changefreq, priority, is_active, lastmod)
SELECT 'https://crawlers.fr/blog/front-loading-title-mot-cle-premier-mot', 'article', 'monthly', 0.6, true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.sitemap_entries
  WHERE loc = 'https://crawlers.fr/blog/front-loading-title-mot-cle-premier-mot'
);