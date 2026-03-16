
-- Table pour stocker les données brutes de tous les audits
CREATE TABLE public.audit_raw_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  audit_type TEXT NOT NULL, -- 'technical', 'strategic', 'crawl'
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_functions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index partiel pour requêtes fréquentes (recalcul par domaine)
CREATE INDEX idx_audit_raw_data_domain_created ON public.audit_raw_data (domain, created_at DESC);
CREATE INDEX idx_audit_raw_data_user_id ON public.audit_raw_data (user_id);
CREATE INDEX idx_audit_raw_data_audit_type ON public.audit_raw_data (audit_type);

-- RLS
ALTER TABLE public.audit_raw_data ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres données raw
CREATE POLICY "Users can view own raw data"
  ON public.audit_raw_data FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all raw data"
  ON public.audit_raw_data FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insertion via service_role uniquement (edge functions)
CREATE POLICY "Service role can insert raw data"
  ON public.audit_raw_data FOR INSERT
  TO service_role
  WITH CHECK (true);
