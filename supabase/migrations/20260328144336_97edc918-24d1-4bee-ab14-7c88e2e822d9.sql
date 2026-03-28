
-- Table to track active sessions per user (fair-use: 1 IP per seat)
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  kicked_reason TEXT,
  UNIQUE(user_id, session_token)
);

-- Index for quick lookups
CREATE INDEX idx_user_sessions_user_active ON public.user_sessions (user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_heartbeat ON public.user_sessions (last_heartbeat_at) WHERE is_active = true;

-- RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role handles inserts/updates (via edge function)
-- No direct client insert/update policies needed

-- Auto-save drafts table for Content/Code Architect work state
CREATE TABLE public.workspace_autosaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  workspace_type TEXT NOT NULL, -- 'content_architect', 'code_architect', 'crawlers'
  workspace_key TEXT NOT NULL, -- unique key per workspace instance (e.g. domain + url)
  state_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_type, workspace_key)
);

CREATE INDEX idx_workspace_autosaves_user ON public.workspace_autosaves (user_id, workspace_type);

ALTER TABLE public.workspace_autosaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own autosaves"
  ON public.workspace_autosaves FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to count max allowed sessions per user (based on team size)
CREATE OR REPLACE FUNCTION public.get_max_sessions(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 1 + COALESCE(
    (SELECT COUNT(*)::integer FROM agency_team_members 
     WHERE owner_user_id = p_user_id),
    0
  );
$$;

-- Cleanup stale sessions (no heartbeat for > 10 min)
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE user_sessions
  SET is_active = false, kicked_reason = 'stale_timeout'
  WHERE is_active = true
    AND last_heartbeat_at < now() - interval '10 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
