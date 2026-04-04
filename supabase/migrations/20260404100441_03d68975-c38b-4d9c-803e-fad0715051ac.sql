
-- Table to track patch effectiveness (feedback loop for agents)
CREATE TABLE public.patch_effectiveness (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL,
  domain TEXT NOT NULL,
  target_function TEXT NOT NULL,
  agent_source TEXT NOT NULL DEFAULT 'cto',
  deployment_date TIMESTAMPTZ NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  errors_before INTEGER NOT NULL DEFAULT 0,
  errors_after INTEGER NOT NULL DEFAULT 0,
  error_reduction_pct NUMERIC,
  sav_complaints_before INTEGER DEFAULT 0,
  sav_complaints_after INTEGER DEFAULT 0,
  is_effective BOOLEAN,
  measurement_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX idx_patch_effectiveness_domain ON public.patch_effectiveness(domain);
CREATE INDEX idx_patch_effectiveness_agent ON public.patch_effectiveness(agent_source);
CREATE INDEX idx_patch_effectiveness_proposal ON public.patch_effectiveness(proposal_id);

-- RLS
ALTER TABLE public.patch_effectiveness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view patch effectiveness"
ON public.patch_effectiveness FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert patch effectiveness"
ON public.patch_effectiveness FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
