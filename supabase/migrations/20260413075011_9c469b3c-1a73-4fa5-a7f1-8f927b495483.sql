
-- 1. Extend prospect_outreach_queue with sequencing columns
ALTER TABLE public.prospect_outreach_queue
  ADD COLUMN IF NOT EXISTS step_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'linkedin',
  ADD COLUMN IF NOT EXISTS sequence_id uuid,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_address text;

-- 2. Create outreach_sequences table
CREATE TABLE public.outreach_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  steps jsonb NOT NULL DEFAULT '[
    {"step": 1, "channel": "linkedin", "action": "invitation", "delay_days": 0, "template_key": "invitation"},
    {"step": 2, "channel": "linkedin", "action": "message", "delay_days": 2, "template_key": "pitch"},
    {"step": 3, "channel": "email", "action": "email_pitch", "delay_days": 5, "template_key": "email_pitch"},
    {"step": 4, "channel": "email", "action": "email_followup", "delay_days": 10, "template_key": "email_followup"}
  ]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sequences"
  ON public.outreach_sequences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sequences"
  ON public.outreach_sequences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sequences"
  ON public.outreach_sequences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sequences"
  ON public.outreach_sequences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- FK from prospect_outreach_queue to outreach_sequences
ALTER TABLE public.prospect_outreach_queue
  ADD CONSTRAINT prospect_outreach_queue_sequence_id_fkey
  FOREIGN KEY (sequence_id) REFERENCES public.outreach_sequences(id);

-- 3. Create outreach_events table
CREATE TABLE public.outreach_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.marina_prospects(id) ON DELETE CASCADE,
  queue_item_id uuid REFERENCES public.prospect_outreach_queue(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  event_type text NOT NULL, -- email_sent, email_opened, link_clicked, replied_manually, invitation_sent, message_sent, email_bounced, auto_paused
  channel text NOT NULL DEFAULT 'linkedin', -- linkedin, email
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
  ON public.outreach_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own events"
  ON public.outreach_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_outreach_events_prospect ON public.outreach_events(prospect_id);
CREATE INDEX idx_outreach_events_type ON public.outreach_events(event_type);
CREATE INDEX idx_outreach_events_created ON public.outreach_events(created_at DESC);

-- 4. Create outreach_daily_quotas table
CREATE TABLE public.outreach_daily_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quota_date date NOT NULL DEFAULT CURRENT_DATE,
  invitations_sent integer NOT NULL DEFAULT 0,
  messages_sent integer NOT NULL DEFAULT 0,
  max_invitations integer NOT NULL DEFAULT 20,
  max_messages integer NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quota_date)
);

ALTER TABLE public.outreach_daily_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quotas"
  ON public.outreach_daily_quotas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own quotas"
  ON public.outreach_daily_quotas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quotas"
  ON public.outreach_daily_quotas FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_outreach_sequences_updated_at
  BEFORE UPDATE ON public.outreach_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outreach_daily_quotas_updated_at
  BEFORE UPDATE ON public.outreach_daily_quotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
