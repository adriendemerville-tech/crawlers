
-- Add unique constraint on url for upsert to work
ALTER TABLE public.analyzed_urls ADD CONSTRAINT analyzed_urls_url_unique UNIQUE (url);

-- Allow anyone to insert analyzed URLs (analytics tracking)
CREATE POLICY "Anyone can insert analyzed urls"
  ON public.analyzed_urls FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update analyzed URLs (for upsert increment)
CREATE POLICY "Anyone can update analyzed urls"
  ON public.analyzed_urls FOR UPDATE
  USING (true);
