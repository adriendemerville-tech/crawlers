-- Pipeline Update Sprint 1 — table d'artefacts
CREATE TABLE public.update_artifacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID,
  slug TEXT NOT NULL,
  url TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('extracted','guidance','claims','topic_gaps','mentions','draft')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('strategic_monitoring','manual','copilot')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX update_artifacts_user_slug_stage_idx
  ON public.update_artifacts (user_id, slug, stage);

CREATE INDEX update_artifacts_tracked_site_idx
  ON public.update_artifacts (tracked_site_id) WHERE tracked_site_id IS NOT NULL;

CREATE INDEX update_artifacts_expires_idx
  ON public.update_artifacts (expires_at);

ALTER TABLE public.update_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own update artifacts"
  ON public.update_artifacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own update artifacts"
  ON public.update_artifacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own update artifacts"
  ON public.update_artifacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own update artifacts"
  ON public.update_artifacts FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_artifacts_updated_at
  BEFORE UPDATE ON public.update_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();