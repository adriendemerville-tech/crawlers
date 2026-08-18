ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS value_proposition text,
  ADD COLUMN IF NOT EXISTS secondary_propositions text;

COMMENT ON COLUMN public.tracked_sites.value_proposition IS 'Proposition de valeur centrale de l''entreprise (carte d''identité) — utilisée pour cadrer le benchmark LLM principal.';
COMMENT ON COLUMN public.tracked_sites.secondary_propositions IS 'Deux propositions de valeur secondaires, séparées par " ; ".';