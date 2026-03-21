
-- SAV AI conversations registry
CREATE TABLE public.sav_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count INTEGER NOT NULL DEFAULT 0,
  escalated BOOLEAN NOT NULL DEFAULT false,
  phone_callback TEXT,
  phone_callback_expires_at TIMESTAMPTZ,
  satisfaction_resolved BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sav_conversations ENABLE ROW LEVEL SECURITY;

-- Users can see their own conversations
CREATE POLICY "Users can view own sav conversations"
ON public.sav_conversations FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own conversations
CREATE POLICY "Users can create sav conversations"
ON public.sav_conversations FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own conversations
CREATE POLICY "Users can update own sav conversations"
ON public.sav_conversations FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Admins can see all
CREATE POLICY "Admins can view all sav conversations"
ON public.sav_conversations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Auto-cleanup phone numbers after 48h
CREATE OR REPLACE FUNCTION public.cleanup_expired_phone_callbacks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.sav_conversations
  SET phone_callback = NULL, phone_callback_expires_at = NULL
  WHERE phone_callback IS NOT NULL AND phone_callback_expires_at < now();
$$;

-- Trigger updated_at
CREATE TRIGGER update_sav_conversations_updated_at
  BEFORE UPDATE ON public.sav_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
