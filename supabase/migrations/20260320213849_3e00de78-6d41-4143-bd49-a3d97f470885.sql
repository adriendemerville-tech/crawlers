
-- Table to cache SerpAPI search results
CREATE TABLE public.serpapi_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tracked_site_id uuid REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  query_text text NOT NULL,
  search_engine text NOT NULL DEFAULT 'google',
  location text,
  language text DEFAULT 'fr',
  country text DEFAULT 'fr',
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  organic_results jsonb,
  ads_results jsonb,
  knowledge_graph jsonb,
  related_searches jsonb,
  search_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Index for fast lookups
CREATE INDEX idx_serpapi_cache_user ON public.serpapi_cache(user_id);
CREATE INDEX idx_serpapi_cache_site ON public.serpapi_cache(tracked_site_id);
CREATE INDEX idx_serpapi_cache_query ON public.serpapi_cache(query_text, search_engine, location);
CREATE INDEX idx_serpapi_cache_expires ON public.serpapi_cache(expires_at);

-- Enable RLS
ALTER TABLE public.serpapi_cache ENABLE ROW LEVEL SECURITY;

-- User can read their own cache
CREATE POLICY "Users read own serpapi cache"
  ON public.serpapi_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role inserts (edge function)
CREATE POLICY "Service role inserts serpapi cache"
  ON public.serpapi_cache FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role deletes expired
CREATE POLICY "Service role deletes serpapi cache"
  ON public.serpapi_cache FOR DELETE
  TO service_role
  USING (true);

-- Admin read all
CREATE POLICY "Admin reads all serpapi cache"
  ON public.serpapi_cache FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
