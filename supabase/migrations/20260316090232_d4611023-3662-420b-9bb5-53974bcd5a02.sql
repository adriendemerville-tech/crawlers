-- Bug fix: Add missing SELECT and DELETE policies on cocoon_chat_histories
CREATE POLICY "Users can select chat histories"
ON public.cocoon_chat_histories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can delete chat histories"
ON public.cocoon_chat_histories
FOR DELETE
TO authenticated
USING (true);