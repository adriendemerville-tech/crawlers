
-- ═══════════════════════════════════════════════════════════
-- site_memory: Structured key-value memory per tracked site
-- Used by Félix (SAV) and Stratège Cocoon for persistent context
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.site_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  source TEXT NOT NULL DEFAULT 'felix',
  confidence NUMERIC(3,1) DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tracked_site_id, memory_key)
);

-- Index for fast lookups by site
CREATE INDEX idx_site_memory_site ON public.site_memory(tracked_site_id);
CREATE INDEX idx_site_memory_category ON public.site_memory(tracked_site_id, category);

-- RLS
ALTER TABLE public.site_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own site memory"
  ON public.site_memory FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own site memory"
  ON public.site_memory FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own site memory"
  ON public.site_memory FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own site memory"
  ON public.site_memory FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access site_memory"
  ON public.site_memory FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE TRIGGER update_site_memory_updated_at
  BEFORE UPDATE ON public.site_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- identity_card_suggestions: Pending identity card changes
-- For hybrid mode: critical fields need user validation
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.identity_card_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  current_value TEXT,
  suggested_value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'felix',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_identity_suggestions_pending ON public.identity_card_suggestions(tracked_site_id, status) WHERE status = 'pending';

ALTER TABLE public.identity_card_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own suggestions"
  ON public.identity_card_suggestions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own suggestions"
  ON public.identity_card_suggestions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access suggestions"
  ON public.identity_card_suggestions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
