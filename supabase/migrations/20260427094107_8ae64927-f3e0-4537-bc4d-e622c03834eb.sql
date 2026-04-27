
-- Table : groupes de pages sauvegardés pour l'explorateur GA4
CREATE TABLE public.ga4_page_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  page_paths TEXT[] NOT NULL DEFAULT '{}',
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ga4_page_groups_user_site ON public.ga4_page_groups(user_id, tracked_site_id);

ALTER TABLE public.ga4_page_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own page groups"
  ON public.ga4_page_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own page groups"
  ON public.ga4_page_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own page groups"
  ON public.ga4_page_groups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own page groups"
  ON public.ga4_page_groups FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_ga4_page_groups_updated_at
  BEFORE UPDATE ON public.ga4_page_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
