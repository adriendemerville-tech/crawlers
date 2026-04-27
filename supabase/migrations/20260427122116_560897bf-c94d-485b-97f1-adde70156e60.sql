CREATE TABLE IF NOT EXISTS public.serp_intent_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_site_id UUID NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  keyword TEXT NOT NULL,
  page_url TEXT NULL,
  our_position INTEGER NULL,
  position_source TEXT NULL CHECK (position_source IS NULL OR position_source IN ('gsc', 'dataforseo_labs', 'unknown')),
  detected_intents JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
  coverage_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,
  serp_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  serp_provider TEXT NOT NULL DEFAULT 'dataforseo' CHECK (serp_provider IN ('dataforseo', 'serper', 'fallback')),
  cost_usd NUMERIC(8,4) NULL,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une seule analyse active par (user, domain, keyword, page_url)
CREATE UNIQUE INDEX IF NOT EXISTS uq_serp_intent_analyses_active
  ON public.serp_intent_analyses (user_id, domain, keyword, COALESCE(page_url, ''));

CREATE INDEX IF NOT EXISTS idx_serp_intent_analyses_site_keyword
  ON public.serp_intent_analyses (tracked_site_id, keyword);

CREATE INDEX IF NOT EXISTS idx_serp_intent_analyses_expires
  ON public.serp_intent_analyses (expires_at);

CREATE INDEX IF NOT EXISTS idx_serp_intent_analyses_recent
  ON public.serp_intent_analyses (user_id, analyzed_at DESC);

ALTER TABLE public.serp_intent_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own intent analyses"
  ON public.serp_intent_analyses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own intent analyses"
  ON public.serp_intent_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own intent analyses"
  ON public.serp_intent_analyses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own intent analyses"
  ON public.serp_intent_analyses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all intent analyses"
  ON public.serp_intent_analyses
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_serp_intent_analyses_updated_at
  BEFORE UPDATE ON public.serp_intent_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();