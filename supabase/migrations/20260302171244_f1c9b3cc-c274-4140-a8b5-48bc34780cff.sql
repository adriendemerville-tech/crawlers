
-- Create a public storage bucket for plugin downloads
INSERT INTO storage.buckets (id, name, public)
VALUES ('plugins', 'plugins', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the plugins bucket
CREATE POLICY "Anyone can download plugins"
ON storage.objects
FOR SELECT
USING (bucket_id = 'plugins');

-- Only admins can upload plugins
CREATE POLICY "Admins can upload plugins"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'plugins' AND public.has_role(auth.uid(), 'admin'));
