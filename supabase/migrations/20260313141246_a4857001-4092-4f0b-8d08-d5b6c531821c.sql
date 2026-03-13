
-- Table to store LLM depth conversation exchanges (prompts + summarized responses)
-- Auto-cleaned after 7 days via expires_at
CREATE TABLE public.llm_depth_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  llm_name text NOT NULL,
  iteration integer NOT NULL,
  prompt_text text NOT NULL,
  response_summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- Index for fast lookups
CREATE INDEX idx_llm_depth_conv_site_user ON public.llm_depth_conversations(tracked_site_id, user_id, llm_name);
CREATE INDEX idx_llm_depth_conv_expires ON public.llm_depth_conversations(expires_at);

-- Enable RLS
ALTER TABLE public.llm_depth_conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations
CREATE POLICY "Users can view own depth conversations"
  ON public.llm_depth_conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role inserts (from edge function)
CREATE POLICY "Service role can insert depth conversations"
  ON public.llm_depth_conversations
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- Cleanup function for expired conversations
CREATE OR REPLACE FUNCTION public.cleanup_expired_depth_conversations()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.llm_depth_conversations WHERE expires_at < now();
$$;
