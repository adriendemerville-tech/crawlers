
-- 1. Add is_indexable column to crawl_pages for combined index status
ALTER TABLE public.crawl_pages ADD COLUMN IF NOT EXISTS is_indexable boolean DEFAULT true;
ALTER TABLE public.crawl_pages ADD COLUMN IF NOT EXISTS index_source text DEFAULT 'crawler';

-- 2. Create crawl_index_history table for weekly snapshots
CREATE TABLE IF NOT EXISTS public.crawl_index_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  user_id uuid NOT NULL,
  tracked_site_id uuid REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  week_start_date text NOT NULL,
  indexed_count integer NOT NULL DEFAULT 0,
  noindex_count integer NOT NULL DEFAULT 0,
  total_pages integer NOT NULL DEFAULT 0,
  sitemap_count integer,
  gsc_indexed_count integer,
  dataforseo_indexed_count integer,
  crawl_id uuid REFERENCES public.site_crawls(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain, user_id, week_start_date)
);

-- 3. Enable RLS
ALTER TABLE public.crawl_index_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "Users can view own index history"
  ON public.crawl_index_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage index history"
  ON public.crawl_index_history FOR ALL
  TO service_role
  USING (true);
