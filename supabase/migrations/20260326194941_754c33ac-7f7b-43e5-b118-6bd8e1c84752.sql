CREATE POLICY "Admins can delete any jobs"
ON public.async_jobs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));