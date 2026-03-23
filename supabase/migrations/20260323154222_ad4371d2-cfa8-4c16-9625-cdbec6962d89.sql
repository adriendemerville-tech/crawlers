
-- Add external_backlinks JSONB column to semantic_nodes
ALTER TABLE public.semantic_nodes 
ADD COLUMN IF NOT EXISTS external_backlinks jsonb DEFAULT NULL;

COMMENT ON COLUMN public.semantic_nodes.external_backlinks IS 'Backlinks data from DataForSEO: {referring_domains, backlinks_total, domain_rank_avg, top_anchors[], top_sources[]}';

-- Create table to store per-page backlink scan results (linked to crawl)
CREATE TABLE IF NOT EXISTS public.crawl_page_backlinks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id uuid NOT NULL REFERENCES public.site_crawls(id) ON DELETE CASCADE,
  url text NOT NULL,
  path text NOT NULL DEFAULT '/',
  referring_domains integer DEFAULT 0,
  backlinks_total integer DEFAULT 0,
  domain_rank_avg numeric DEFAULT 0,
  top_anchors jsonb DEFAULT '[]'::jsonb,
  top_sources jsonb DEFAULT '[]'::jsonb,
  page_authority_internal numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(crawl_id, url)
);

ALTER TABLE public.crawl_page_backlinks ENABLE ROW LEVEL SECURITY;

-- RLS: users can read their own crawl backlinks
CREATE POLICY "Users can read own crawl backlinks"
ON public.crawl_page_backlinks
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.site_crawls sc
    WHERE sc.id = crawl_page_backlinks.crawl_id
    AND sc.user_id = auth.uid()
  )
);

-- Service role can insert
CREATE POLICY "Service can insert crawl backlinks"
ON public.crawl_page_backlinks
FOR INSERT TO service_role
WITH CHECK (true);
