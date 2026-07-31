ALTER TABLE public.linkedin_features_catalog
  ADD COLUMN IF NOT EXISTS capture_scenario jsonb,
  ADD COLUMN IF NOT EXISTS capture_scenario_source text,
  ADD COLUMN IF NOT EXISTS capture_scenario_updated_at timestamptz;

COMMENT ON COLUMN public.linkedin_features_catalog.capture_scenario IS
  'Scenario deterministe Pagebolt : tableau de steps {action, selector?, url?, value?, ms?, name?, note?} execute par /v1/sequence (carrousel) et /v1/video (screencast).';
COMMENT ON COLUMN public.linkedin_features_catalog.capture_scenario_source IS
  'manual = redige a la main dans l''admin, auto = decouvert via Pagebolt /v1/inspect.';