UPDATE public.sitemap_entries
   SET is_active = false
 WHERE domain = 'crawlers.fr'
   AND loc IN (
     'https://crawlers.fr/passe-visibilite',
     'https://crawlers.fr/blog/tableau-comparatif-seo-geo-2026',
     'https://crawlers.fr/blog/mission-mise-aux-normes-ia',
     'https://crawlers.fr/blog/audit-seo-gratuit-vs-semrush',
     'https://crawlers.fr/etudes/autopilot-parmenion-iktracker',
     'https://crawlers.fr/docs/api/parmenion'
   );