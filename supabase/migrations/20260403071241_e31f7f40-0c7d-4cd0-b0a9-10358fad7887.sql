
DROP POLICY "Service can insert log entries" ON public.log_entries;

CREATE POLICY "Owners and service can insert log entries"
  ON public.log_entries FOR INSERT TO authenticated
  WITH CHECK (public.owns_tracked_site(tracked_site_id) OR public.has_role(auth.uid(), 'admin'));
