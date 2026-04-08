
CREATE TABLE public.page_priority_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  page_url TEXT NOT NULL,
  priority_score NUMERIC NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tracked_site_id, page_url)
);

ALTER TABLE public.page_priority_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own page scores"
  ON public.page_priority_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own page scores"
  ON public.page_priority_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own page scores"
  ON public.page_priority_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own page scores"
  ON public.page_priority_scores FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on page_priority_scores"
  ON public.page_priority_scores FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_page_priority_scores_score ON public.page_priority_scores (tracked_site_id, priority_score DESC);
CREATE INDEX idx_page_priority_scores_domain ON public.page_priority_scores (domain);

CREATE TRIGGER update_page_priority_scores_updated_at
  BEFORE UPDATE ON public.page_priority_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
