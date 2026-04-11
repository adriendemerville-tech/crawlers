-- Ajouter 'deployed' à l'enum workbench_item_status
ALTER TYPE public.workbench_item_status ADD VALUE IF NOT EXISTS 'deployed' BEFORE 'done';

-- Ajouter colonnes pour le contre-audit
ALTER TABLE public.architect_workbench
  ADD COLUMN IF NOT EXISTS deployed_at timestamptz,
  ADD COLUMN IF NOT EXISTS validate_attempts integer NOT NULL DEFAULT 0;
