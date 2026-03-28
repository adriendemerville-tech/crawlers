
-- Allow service_role to upload to parmenion/ folder in image-references bucket
-- (service_role bypasses RLS by default, but let's also allow public read for parmenion images)
CREATE POLICY "Public read parmenion images"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'image-references' AND (storage.foldername(name))[1] = 'parmenion');
