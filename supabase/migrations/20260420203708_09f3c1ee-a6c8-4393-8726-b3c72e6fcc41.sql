DROP POLICY IF EXISTS "Service role full access persona rotation" ON public.persona_rotation_log;

CREATE POLICY "Service role manages persona rotation"
  ON public.persona_rotation_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);