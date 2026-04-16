-- Fix INSERT policies so the backend service-role can persist logs and briefings.
-- The previous policies required auth.uid() = user_id, but the pipeline runs under
-- service-role (auth.uid() is NULL), so every insert silently failed.

DROP POLICY IF EXISTS "Service role inserts pipeline logs" ON public.editorial_pipeline_logs;
CREATE POLICY "Service role inserts pipeline logs"
  ON public.editorial_pipeline_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users insert own briefings" ON public.editorial_briefing_packets;
CREATE POLICY "Service role inserts briefings"
  ON public.editorial_briefing_packets
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');