-- Enable realtime for support tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- Add index for faster message queries
CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id ON public.support_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id ON public.support_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_support_conversations_status ON public.support_conversations(status);