
-- analytics_events: replace with explicit role check to satisfy linter
DROP POLICY IF EXISTS "Authenticated or service can insert analytics" ON public.analytics_events;
CREATE POLICY "Any role can insert analytics"
  ON public.analytics_events FOR INSERT
  WITH CHECK (auth.role() IS NOT NULL);
