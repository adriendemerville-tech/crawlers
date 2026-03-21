
CREATE TABLE public.cocoon_architect_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cocoon_architect_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own drafts" ON public.cocoon_architect_drafts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own drafts" ON public.cocoon_architect_drafts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own drafts" ON public.cocoon_architect_drafts
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service role full access" ON public.cocoon_architect_drafts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_cocoon_architect_drafts_user_site ON public.cocoon_architect_drafts(user_id, tracked_site_id);
