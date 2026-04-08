
DROP POLICY "Service role full access on page_priority_scores" ON public.page_priority_scores;

CREATE POLICY "Service role full access on page_priority_scores"
  ON public.page_priority_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
