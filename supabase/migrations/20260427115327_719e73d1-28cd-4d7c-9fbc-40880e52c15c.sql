-- Table : iktracker_slug_memory
-- Persistance des verdicts API IKtracker pour éviter les republications en boucle

CREATE TABLE IF NOT EXISTS public.iktracker_slug_memory (
  slug TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'iktracker.fr',
  tracked_site_id UUID NULL REFERENCES public.tracked_sites(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('published', 'blacklisted', 'skipped', 'duplicate', 'error')),
  reason TEXT NULL,
  hash_content TEXT NULL,
  iktracker_post_id TEXT NULL,
  attempts_count INTEGER NOT NULL DEFAULT 1,
  last_response JSONB NULL,
  blocked_until TIMESTAMPTZ NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, domain)
);

CREATE INDEX IF NOT EXISTS idx_iktracker_slug_memory_status_seen
  ON public.iktracker_slug_memory (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_iktracker_slug_memory_domain
  ON public.iktracker_slug_memory (domain, last_seen_at DESC);

ALTER TABLE public.iktracker_slug_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view slug memory"
  ON public.iktracker_slug_memory
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete slug memory"
  ON public.iktracker_slug_memory
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Pas de policy INSERT/UPDATE pour authenticated : seul le service_role peut écrire

CREATE OR REPLACE FUNCTION public.update_slug_memory_seen()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.last_seen_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_iktracker_slug_memory_seen ON public.iktracker_slug_memory;
CREATE TRIGGER trg_iktracker_slug_memory_seen
  BEFORE UPDATE ON public.iktracker_slug_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_slug_memory_seen();

COMMENT ON TABLE public.iktracker_slug_memory IS 'Mémoire persistante des verdicts API IKtracker (anti-bouclage agent Parménion)';
COMMENT ON COLUMN public.iktracker_slug_memory.status IS 'published=créé OK, blacklisted=409 admin, skipped=200 _skipped, duplicate=dedup éditorial, error=échec API';
COMMENT ON COLUMN public.iktracker_slug_memory.hash_content IS 'SHA-256 du contenu publié pour détecter modifications réelles vs republication identique';
COMMENT ON COLUMN public.iktracker_slug_memory.iktracker_post_id IS 'ID retourné par IKtracker à la création, requis pour PUT (update) ultérieur';
COMMENT ON COLUMN public.iktracker_slug_memory.blocked_until IS 'Cooldown temporaire (ex: skipped récent → réessai dans 7j)';