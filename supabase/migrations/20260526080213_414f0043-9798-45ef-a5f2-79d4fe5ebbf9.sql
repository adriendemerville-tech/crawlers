
-- 1. Clés API personnelles
CREATE TABLE public.crawlers_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['*'],
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crawlers_api_keys_user ON public.crawlers_api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_crawlers_api_keys_hash ON public.crawlers_api_keys(key_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.crawlers_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own api keys"
  ON public.crawlers_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users revoke own api keys"
  ON public.crawlers_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own api keys"
  ON public.crawlers_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Pas de INSERT direct : uniquement via la RPC crawlers_api_create_key

-- 2. Jobs API
CREATE TABLE public.crawlers_api_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.crawlers_api_keys(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  result JSONB,
  error JSONB,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_crawlers_api_jobs_user ON public.crawlers_api_jobs(user_id, created_at DESC);
CREATE INDEX idx_crawlers_api_jobs_status ON public.crawlers_api_jobs(status, created_at) WHERE status IN ('queued','running');

ALTER TABLE public.crawlers_api_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own jobs"
  ON public.crawlers_api_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- 3. RPC : créer une clé (retourne la clé en clair une seule fois)
CREATE OR REPLACE FUNCTION public.crawlers_api_create_key(_name TEXT DEFAULT 'Default')
RETURNS TABLE(id UUID, api_key TEXT, key_prefix TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid UUID := auth.uid();
  _raw TEXT;
  _full TEXT;
  _prefix TEXT;
  _hash TEXT;
  _id UUID;
  _created TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  _raw := encode(gen_random_bytes(24), 'hex');
  _full := 'crw_live_' || _raw;
  _prefix := substring(_full from 1 for 16);
  _hash := encode(digest(_full, 'sha256'), 'hex');

  INSERT INTO public.crawlers_api_keys (user_id, name, key_prefix, key_hash)
  VALUES (_uid, COALESCE(NULLIF(trim(_name), ''), 'Default'), _prefix, _hash)
  RETURNING crawlers_api_keys.id, crawlers_api_keys.created_at INTO _id, _created;

  RETURN QUERY SELECT _id, _full, _prefix, _created;
END;
$$;

REVOKE ALL ON FUNCTION public.crawlers_api_create_key(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crawlers_api_create_key(TEXT) TO authenticated;

-- 4. RPC : vérifier une clé (utilisée par l'edge function en service_role)
CREATE OR REPLACE FUNCTION public.crawlers_api_verify_token(_token TEXT)
RETURNS TABLE(user_id UUID, key_id UUID, scopes TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash TEXT;
BEGIN
  IF _token IS NULL OR length(_token) < 20 OR _token NOT LIKE 'crw_live_%' THEN
    RETURN;
  END IF;

  _hash := encode(digest(_token, 'sha256'), 'hex');

  RETURN QUERY
  UPDATE public.crawlers_api_keys k
     SET last_used_at = now()
   WHERE k.key_hash = _hash
     AND k.revoked_at IS NULL
  RETURNING k.user_id, k.id, k.scopes;
END;
$$;

REVOKE ALL ON FUNCTION public.crawlers_api_verify_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crawlers_api_verify_token(TEXT) TO service_role;
