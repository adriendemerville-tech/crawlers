-- Table for OAuth CSRF state tokens
CREATE TABLE IF NOT EXISTS public.social_oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  tracked_site_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- No RLS needed — only accessed by service role in edge functions
ALTER TABLE public.social_oauth_states ENABLE ROW LEVEL SECURITY;

-- Add unique constraint on social_accounts for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'social_accounts_user_platform_unique'
  ) THEN
    ALTER TABLE public.social_accounts ADD CONSTRAINT social_accounts_user_platform_unique UNIQUE (user_id, platform);
  END IF;
END $$;

-- Index for fast state lookup
CREATE INDEX IF NOT EXISTS idx_social_oauth_states_state ON public.social_oauth_states(state);

-- Auto-cleanup expired states (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.social_oauth_states WHERE expires_at < now() - interval '1 hour';
$$;