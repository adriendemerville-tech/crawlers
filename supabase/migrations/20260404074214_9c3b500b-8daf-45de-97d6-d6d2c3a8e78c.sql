
DROP POLICY "Service can insert CTO proposals" ON public.cto_code_proposals;

CREATE POLICY "Admins can insert CTO proposals"
  ON public.cto_code_proposals FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
