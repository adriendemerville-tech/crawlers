-- Sprint 7 — Table matrix_audits pour historiser les audits matriciels
CREATE TABLE public.matrix_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id UUID NULL,
  label TEXT NOT NULL DEFAULT 'Audit matriciel',
  audit_type TEXT NOT NULL DEFAULT 'rapport',
  status TEXT NOT NULL DEFAULT 'completed',
  global_score NUMERIC NULL,
  items_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NULL,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  pivot_snapshot JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index principal pour la liste historique
CREATE INDEX idx_matrix_audits_user_created
  ON public.matrix_audits (user_id, created_at DESC);

CREATE INDEX idx_matrix_audits_site
  ON public.matrix_audits (site_id)
  WHERE site_id IS NOT NULL;

-- RLS
ALTER TABLE public.matrix_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matrix audits"
  ON public.matrix_audits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own matrix audits"
  ON public.matrix_audits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own matrix audits"
  ON public.matrix_audits
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own matrix audits"
  ON public.matrix_audits
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at (réutilise la fonction existante update_updated_at_column si présente, sinon créer)
CREATE OR REPLACE FUNCTION public.matrix_audits_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_matrix_audits_updated_at
  BEFORE UPDATE ON public.matrix_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.matrix_audits_set_updated_at();

-- Validation status
ALTER TABLE public.matrix_audits
  ADD CONSTRAINT matrix_audits_status_chk
  CHECK (status IN ('completed', 'partial', 'failed'));

ALTER TABLE public.matrix_audits
  ADD CONSTRAINT matrix_audits_audit_type_chk
  CHECK (audit_type IN ('rapport', 'expert', 'eeat', 'marina', 'custom'));