-- 10.7 : author_aliases DB-driven (JSONB array) avec fallback statique
ALTER TABLE public.parmenion_targets
  ADD COLUMN IF NOT EXISTS author_aliases jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.parmenion_targets.author_aliases IS
  'Tableau JSON de patterns (lowercase, substring match) identifiant les contenus écrits par Parménion sur ce domaine. Si vide → fallback vers la liste statique (parménion, parmenion, crawlers autopilot).';

-- Seed les domaines existants avec la liste statique pour qu'aucun comportement ne change
UPDATE public.parmenion_targets
SET author_aliases = '["parménion","parmenion","crawlers autopilot"]'::jsonb
WHERE author_aliases = '[]'::jsonb OR author_aliases IS NULL;

-- 10.3 : compteur de cycles consécutifs sautés à cause d'un crawl bloqué/non frais
ALTER TABLE public.parmenion_targets
  ADD COLUMN IF NOT EXISTS consecutive_crawl_skips integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_crawl_skip_at timestamptz;

COMMENT ON COLUMN public.parmenion_targets.consecutive_crawl_skips IS
  'Compteur incrémenté à chaque cycle Parménion sauté à cause de crawl obsolète ou in-flight. Reset à 0 dès qu''un cycle s''exécute normalement. Seuil d''alerte : >= 5.';

-- RPC SECURITY DEFINER pour lire les aliases sans exposer la table
CREATE OR REPLACE FUNCTION public.get_parmenion_author_aliases(p_domain text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(author_aliases, '[]'::jsonb)
  FROM public.parmenion_targets
  WHERE lower(domain) = lower(p_domain)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_parmenion_author_aliases(text) TO authenticated, service_role;