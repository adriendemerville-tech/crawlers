-- Create the public-assets storage bucket for sitemap.xml and other static assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to all files in public-assets bucket
CREATE POLICY "Public read access on public-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'public-assets');

-- Only service_role can upload/update/delete (via edge functions)
-- No INSERT/UPDATE/DELETE policies for anon/authenticated = service_role only via admin client
