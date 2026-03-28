
-- Create public bucket for image references
INSERT INTO storage.buckets (id, name, public)
VALUES ('image-references', 'image-references', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their own folder
CREATE POLICY "Users can upload image references"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'image-references' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can view their own references
CREATE POLICY "Users can view own image references"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'image-references' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can delete their own references
CREATE POLICY "Users can delete own image references"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'image-references' AND (storage.foldername(name))[1] = auth.uid()::text);
