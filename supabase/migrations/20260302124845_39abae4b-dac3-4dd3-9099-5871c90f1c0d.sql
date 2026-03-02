
-- Table des sites suivis par l'utilisateur
CREATE TABLE public.tracked_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  site_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_audit_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, domain)
);

ALTER TABLE public.tracked_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tracked sites"
  ON public.tracked_sites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tracked sites"
  ON public.tracked_sites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracked sites"
  ON public.tracked_sites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracked sites"
  ON public.tracked_sites FOR DELETE
  USING (auth.uid() = user_id);

-- Table d'historique des scores pour chaque site suivi
CREATE TABLE public.user_stats_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  seo_score INTEGER,
  geo_score INTEGER,
  llm_citation_rate NUMERIC,
  ai_sentiment TEXT,
  semantic_authority NUMERIC,
  voice_share NUMERIC,
  technical_errors_fixed INTEGER,
  ads_budget_saved NUMERIC,
  raw_data JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_stats_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stats history"
  ON public.user_stats_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats history"
  ON public.user_stats_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stats history"
  ON public.user_stats_history FOR DELETE
  USING (auth.uid() = user_id);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_tracked_sites_user_id ON public.tracked_sites(user_id);
CREATE INDEX idx_user_stats_history_tracked_site ON public.user_stats_history(tracked_site_id, recorded_at DESC);
CREATE INDEX idx_user_stats_history_user_id ON public.user_stats_history(user_id);
