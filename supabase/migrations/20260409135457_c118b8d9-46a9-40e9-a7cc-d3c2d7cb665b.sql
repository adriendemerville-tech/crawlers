-- Create storage bucket for UX screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ux-screenshots', 'ux-screenshots', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "UX screenshots are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'ux-screenshots');

-- Service role can upload (edge functions)
CREATE POLICY "Service role can upload UX screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ux-screenshots');

CREATE POLICY "Service role can update UX screenshots"
ON storage.objects FOR UPDATE
USING (bucket_id = 'ux-screenshots');

CREATE POLICY "Service role can delete UX screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'ux-screenshots');