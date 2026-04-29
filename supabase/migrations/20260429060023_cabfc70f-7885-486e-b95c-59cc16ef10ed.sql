
-- Table de cache persistant pour les structures générées par Content Architect
CREATE TABLE public.content_architect_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  domain text,
  keyword text NOT NULL,
  page_type text,
  length text,
  lang text DEFAULT 'fr',
  markdown text NOT NULL,
  payload jsonb,
  is_shareable boolean NOT NULL DEFAULT true,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE UNIQUE INDEX content_architect_cache_user_key_idx
  ON public.content_architect_cache (user_id, cache_key);

CREATE INDEX content_architect_cache_shared_idx
  ON public.content_architect_cache (cache_key, last_used_at DESC)
  WHERE is_shareable = true;

CREATE INDEX content_architect_cache_expires_idx
  ON public.content_architect_cache (expires_at);

ALTER TABLE public.content_architect_cache ENABLE ROW LEVEL SECURITY;

-- RLS : isolation stricte par user pour SELECT / INSERT / UPDATE / DELETE
CREATE POLICY "users_select_own_cache"
  ON public.content_architect_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_cache"
  ON public.content_architect_cache FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_cache"
  ON public.content_architect_cache FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_cache"
  ON public.content_architect_cache FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fonction SECURITY DEFINER : retourne 1 reco anonymisée d'un autre user
-- Ne révèle JAMAIS user_id, juste le markdown et la fraîcheur.
CREATE OR REPLACE FUNCTION public.get_shared_architect_recommendation(
  _cache_key text
)
RETURNS TABLE (
  markdown text,
  payload jsonb,
  created_at timestamptz,
  hit_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.markdown, c.payload, c.created_at, c.hit_count
  FROM public.content_architect_cache c
  WHERE c.cache_key = _cache_key
    AND c.is_shareable = true
    AND c.expires_at > now()
    AND c.user_id <> auth.uid()
  ORDER BY c.hit_count DESC, c.last_used_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_shared_architect_recommendation(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_architect_recommendation(text) TO authenticated;
