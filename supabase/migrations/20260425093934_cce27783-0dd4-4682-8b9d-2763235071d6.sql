-- ═══════════════════════════════════════════════════════════════
-- SPRINT 1 — Copilot infrastructure (1 backend, N personas)
-- ═══════════════════════════════════════════════════════════════

-- ── Table: copilot_sessions ───────────────────────────────────
CREATE TABLE public.copilot_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  persona TEXT NOT NULL CHECK (persona IN ('felix', 'strategist')),
  title TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_sessions_user ON public.copilot_sessions(user_id, last_message_at DESC);
CREATE INDEX idx_copilot_sessions_persona ON public.copilot_sessions(persona, status);

ALTER TABLE public.copilot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sessions"
  ON public.copilot_sessions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own sessions"
  ON public.copilot_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
  ON public.copilot_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users archive own sessions"
  ON public.copilot_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_copilot_sessions_updated_at
  BEFORE UPDATE ON public.copilot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Table: copilot_actions (audit trail immuable) ─────────────
CREATE TABLE public.copilot_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.copilot_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  persona TEXT NOT NULL,
  skill TEXT NOT NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error', 'awaiting_approval', 'rejected')),
  error_message TEXT,
  duration_ms INTEGER,
  llm_cost_usd NUMERIC(10, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_actions_session ON public.copilot_actions(session_id, created_at DESC);
CREATE INDEX idx_copilot_actions_user ON public.copilot_actions(user_id, created_at DESC);
CREATE INDEX idx_copilot_actions_skill ON public.copilot_actions(skill, status);

ALTER TABLE public.copilot_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own actions"
  ON public.copilot_actions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role inserts actions"
  ON public.copilot_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Pas de UPDATE / DELETE policies => audit trail immuable côté users.