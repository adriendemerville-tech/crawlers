
-- Add generation_status to site_script_rules for queuing AI-generated payloads
ALTER TABLE public.site_script_rules 
  ADD COLUMN IF NOT EXISTS generation_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS generation_error text,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz;

-- Index for the queue worker to pick up pending jobs efficiently
CREATE INDEX IF NOT EXISTS idx_script_rules_generation_queue 
  ON public.site_script_rules (generation_status, queued_at)
  WHERE generation_status IN ('pending', 'processing');

COMMENT ON COLUMN public.site_script_rules.generation_status IS 'ready = static payload, pending = waiting for AI generation, processing = being generated, done = AI generated, error = failed';
