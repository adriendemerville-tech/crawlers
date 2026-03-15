CREATE TABLE public.cocoon_chat_histories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash text NOT NULL,
  tracked_site_id text NOT NULL,
  domain text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cocoon_chat_histories_session ON cocoon_chat_histories(session_hash);
CREATE INDEX idx_cocoon_chat_histories_domain ON cocoon_chat_histories(domain);

ALTER TABLE cocoon_chat_histories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert chat histories"
  ON cocoon_chat_histories FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update chat histories"
  ON cocoon_chat_histories FOR UPDATE TO authenticated
  USING (true);

CREATE TRIGGER update_cocoon_chat_histories_updated_at
  BEFORE UPDATE ON cocoon_chat_histories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();