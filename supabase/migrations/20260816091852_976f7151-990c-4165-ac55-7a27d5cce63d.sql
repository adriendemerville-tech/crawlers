CREATE TABLE public.external_render_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url_key text NOT NULL UNIQUE,
  url text NOT NULL,
  html text NOT NULL,
  engine text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_render_cache_expires ON public.external_render_cache (expires_at);

GRANT ALL ON public.external_render_cache TO service_role;

ALTER TABLE public.external_render_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to external render cache"
ON public.external_render_cache
FOR SELECT
TO authenticated
USING (false);

CREATE TRIGGER update_external_render_cache_updated_at
BEFORE UPDATE ON public.external_render_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();