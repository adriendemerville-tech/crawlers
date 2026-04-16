ALTER TABLE public.autopilot_configs
ADD COLUMN IF NOT EXISTS use_editorial_pipeline boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.autopilot_configs.use_editorial_pipeline IS
'When true, Parménion routes editorial content creation through the shared 4-stage editorial pipeline (briefing → strategist → writer → tonalizer) instead of the legacy single-LLM path.';