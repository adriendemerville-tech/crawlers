ALTER TABLE public.parmenion_decision_log 
ADD COLUMN IF NOT EXISTS execution_results jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pipeline_phase text DEFAULT 'diagnose';