-- Create storage bucket for shared reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shared-reports', 'shared-reports', false, 1048576, ARRAY['text/html'])
ON CONFLICT (id) DO NOTHING;

-- Allow edge functions to upload to this bucket (service role)
-- The edge function uses service role key so it has full access

-- Create policy for signed URL access (public read via signed URLs)
CREATE POLICY "Allow public access via signed URLs"
ON storage.objects FOR SELECT
USING (bucket_id = 'shared-reports');