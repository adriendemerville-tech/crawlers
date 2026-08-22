CREATE TABLE public.gmb_url_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  resolved_url TEXT,
  place_id TEXT NOT NULL,
  place_name TEXT,
  place_address TEXT,
  kgmid TEXT,
  score INTEGER,
  grade TEXT,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX gmb_url_audits_user_created_idx ON public.gmb_url_audits (user_id, created_at DESC);
CREATE INDEX gmb_url_audits_place_idx ON public.gmb_url_audits (place_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.gmb_url_audits TO authenticated;
GRANT ALL ON public.gmb_url_audits TO service_role;

ALTER TABLE public.gmb_url_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own listing audits"
  ON public.gmb_url_audits FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create their own listing audits"
  ON public.gmb_url_audits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own listing audits"
  ON public.gmb_url_audits FOR DELETE TO authenticated
  USING (user_id = auth.uid());