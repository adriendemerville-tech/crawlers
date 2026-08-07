CREATE TABLE public.external_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE SET NULL,
  domain TEXT,
  source_label TEXT,
  filename TEXT,
  mime_type TEXT,
  raw_text TEXT NOT NULL,
  char_count INTEGER NOT NULL DEFAULT 0,
  confrontation JSONB,
  confronted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_audits_user ON public.external_audits(user_id, created_at DESC);
CREATE INDEX idx_external_audits_site ON public.external_audits(tracked_site_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_audits TO authenticated;
GRANT ALL ON public.external_audits TO service_role;

ALTER TABLE public.external_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own imported audits"
  ON public.external_audits FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());