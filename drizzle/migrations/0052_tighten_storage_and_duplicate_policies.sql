DROP POLICY IF EXISTS "Service role can update UX screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete UX screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload UX screenshots" ON storage.objects;
CREATE POLICY "Service role can update UX screenshots" ON storage.objects FOR UPDATE TO service_role USING (bucket_id = 'ux-screenshots');
CREATE POLICY "Service role can delete UX screenshots" ON storage.objects FOR DELETE TO service_role USING (bucket_id = 'ux-screenshots');
CREATE POLICY "Service role can upload UX screenshots" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'ux-screenshots');
DROP POLICY IF EXISTS "Allow public access via signed URLs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read system_config" ON public.system_config;