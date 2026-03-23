
-- Table: firehose taps (management)
CREATE TABLE public.firehose_taps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tracked_site_id uuid REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  tap_id text NOT NULL,
  tap_name text NOT NULL,
  token_prefix text,
  tap_token_encrypted text,
  rules_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.firehose_taps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own firehose taps"
  ON public.firehose_taps FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own firehose taps"
  ON public.firehose_taps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own firehose taps"
  ON public.firehose_taps FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own firehose taps"
  ON public.firehose_taps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all firehose taps"
  ON public.firehose_taps FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Table: firehose rules
CREATE TABLE public.firehose_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tap_id uuid NOT NULL REFERENCES public.firehose_taps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rule_id text NOT NULL,
  rule_value text NOT NULL,
  tag text,
  nsfw boolean DEFAULT false,
  quality boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.firehose_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own firehose rules"
  ON public.firehose_rules FOR ALL TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all firehose rules"
  ON public.firehose_rules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Table: firehose events (streamed matches stored)
CREATE TABLE public.firehose_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tap_id uuid NOT NULL REFERENCES public.firehose_taps(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.firehose_rules(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  matched_at timestamptz NOT NULL,
  document_url text NOT NULL,
  document_title text,
  document_language text,
  page_categories text[],
  page_types text[],
  diff_chunks jsonb,
  markdown_excerpt text,
  kafka_offset bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.firehose_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own firehose events"
  ON public.firehose_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all firehose events"
  ON public.firehose_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX idx_firehose_events_tap_id ON public.firehose_events(tap_id);
CREATE INDEX idx_firehose_events_matched_at ON public.firehose_events(matched_at DESC);
CREATE INDEX idx_firehose_events_document_url ON public.firehose_events(document_url);

-- Triggers for updated_at
CREATE TRIGGER update_firehose_taps_updated_at BEFORE UPDATE ON public.firehose_taps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_firehose_rules_updated_at BEFORE UPDATE ON public.firehose_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
