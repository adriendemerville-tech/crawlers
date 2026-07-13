-- RLS policies for linkedin-media bucket: admins can manage, service role handles uploads
CREATE POLICY "Admins can read linkedin-media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'linkedin-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert linkedin-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'linkedin-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete linkedin-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'linkedin-media' AND public.has_role(auth.uid(), 'admin'));