
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS autonomy_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS autonomy_raw jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS autonomy_level text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.autonomy_score IS 'Score d autonomie global (0-100), calculé après le diagnostic Felix';
COMMENT ON COLUMN public.profiles.autonomy_raw IS 'Données brutes du diagnostic: {persona_base, seo_knowledge, autonomy_self, computed_at}';
COMMENT ON COLUMN public.profiles.autonomy_level IS 'Niveau dérivé: beginner, intermediate, expert';
