
-- Table de cache pour les snapshots HTML pré-rendus
CREATE TABLE public.prerender_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route TEXT NOT NULL UNIQUE,
  html_content TEXT NOT NULL,
  content_hash TEXT,
  meta_title TEXT,
  meta_description TEXT,
  rendered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour lookup rapide par route
CREATE INDEX idx_prerender_cache_route ON public.prerender_cache (route);
CREATE INDEX idx_prerender_cache_expires ON public.prerender_cache (expires_at);

-- Enable RLS
ALTER TABLE public.prerender_cache ENABLE ROW LEVEL SECURITY;

-- Lecture publique (bots, crawlers, outils SEO)
CREATE POLICY "Public read access for prerender cache"
ON public.prerender_cache FOR SELECT
USING (true);

-- Trigger updated_at
CREATE TRIGGER update_prerender_cache_updated_at
BEFORE UPDATE ON public.prerender_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
