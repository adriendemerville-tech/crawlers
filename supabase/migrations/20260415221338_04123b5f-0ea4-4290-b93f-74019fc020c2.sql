
CREATE TABLE public.serp_benchmark_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  target_domain TEXT,
  location TEXT DEFAULT 'France',
  language TEXT DEFAULT 'fr',
  country TEXT DEFAULT 'fr',
  providers_used TEXT[] NOT NULL DEFAULT '{}',
  providers_data JSONB NOT NULL DEFAULT '{}',
  averaged_results JSONB NOT NULL DEFAULT '[]',
  single_hit_penalty INT NOT NULL DEFAULT 20,
  total_sites_found INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.serp_benchmark_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own benchmarks"
  ON public.serp_benchmark_results FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own benchmarks"
  ON public.serp_benchmark_results FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own benchmarks"
  ON public.serp_benchmark_results FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_serp_benchmark_user ON public.serp_benchmark_results(user_id);
CREATE INDEX idx_serp_benchmark_site ON public.serp_benchmark_results(tracked_site_id);
