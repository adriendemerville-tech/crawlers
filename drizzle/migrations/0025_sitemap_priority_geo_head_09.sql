-- priority est numeric(2,1) : 0.95 arrondissait à 1.0 et égalait la home.
-- La tête du silo GEO passe à 0.9, ses satellites en dessous.
UPDATE public.sitemap_entries
SET priority = 0.9, updated_at = now()
WHERE domain = 'crawlers.fr' AND loc = 'https://crawlers.fr/audit-geo-seo';

UPDATE public.sitemap_entries
SET priority = 0.8, updated_at = now()
WHERE domain = 'crawlers.fr' AND loc = 'https://crawlers.fr/audit-geo';