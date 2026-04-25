-- Étendre les statuts autorisés pour inclure 'processing'
ALTER TABLE public.copilot_sessions
  DROP CONSTRAINT IF EXISTS copilot_sessions_status_check;

ALTER TABLE public.copilot_sessions
  ADD CONSTRAINT copilot_sessions_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'processing'::text, 'archived'::text]));

-- Ajouter le timestamp de début de traitement (NULL quand idle)
ALTER TABLE public.copilot_sessions
  ADD COLUMN IF NOT EXISTS processing_started_at timestamp with time zone;

-- Index partiel pour détection rapide des sessions bloquées
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_processing
  ON public.copilot_sessions (processing_started_at)
  WHERE status = 'processing';