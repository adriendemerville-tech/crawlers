-- 0. Étendre l'enum cms_platform pour les plateformes Parménion
ALTER TYPE public.cms_platform ADD VALUE IF NOT EXISTS 'dictadevi';
ALTER TYPE public.cms_platform ADD VALUE IF NOT EXISTS 'iktracker';
ALTER TYPE public.cms_platform ADD VALUE IF NOT EXISTS 'custom_rest';