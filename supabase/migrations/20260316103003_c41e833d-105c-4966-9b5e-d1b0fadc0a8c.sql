
-- Allow admins to view all site_crawls for analytics
CREATE POLICY "Admins can view all crawls"
ON public.site_crawls
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all cocoon_sessions for analytics
CREATE POLICY "Admins can view all cocoon sessions"
ON public.cocoon_sessions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
