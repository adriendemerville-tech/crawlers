CREATE POLICY "Public can read published guides"
ON public.seo_page_drafts
FOR SELECT
TO anon, authenticated
USING (status = 'published' AND page_type = 'guide');