
-- Create agency-logos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('agency-logos', 'agency-logos', true);

-- Allow authenticated users to upload their own logos
CREATE POLICY "Users can upload agency logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'agency-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own logos
CREATE POLICY "Users can update agency logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'agency-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own logos
CREATE POLICY "Users can delete agency logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'agency-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Public read access for agency logos
CREATE POLICY "Public read agency logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'agency-logos');
