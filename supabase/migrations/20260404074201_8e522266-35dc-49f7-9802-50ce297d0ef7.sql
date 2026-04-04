
-- Table: CTO code proposals registry
CREATE TABLE public.cto_code_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_function TEXT NOT NULL,
  target_url TEXT,
  domain TEXT NOT NULL,
  proposal_type TEXT NOT NULL DEFAULT 'bugfix',
  title TEXT NOT NULL,
  description TEXT,
  diff_preview TEXT,
  original_code TEXT,
  proposed_code TEXT,
  confidence_score INTEGER DEFAULT 0,
  source_diagnostic_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cto_code_proposals ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all CTO proposals"
  ON public.cto_code_proposals FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update CTO proposals"
  ON public.cto_code_proposals FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete CTO proposals"
  ON public.cto_code_proposals FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert (CTO agent writes proposals)
CREATE POLICY "Service can insert CTO proposals"
  ON public.cto_code_proposals FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Timestamp trigger
CREATE TRIGGER update_cto_code_proposals_updated_at
  BEFORE UPDATE ON public.cto_code_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_cto_code_proposals_status ON public.cto_code_proposals(status);
CREATE INDEX idx_cto_code_proposals_domain ON public.cto_code_proposals(domain);
