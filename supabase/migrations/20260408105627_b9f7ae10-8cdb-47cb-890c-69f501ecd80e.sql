
CREATE TABLE public.indexation_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  page_url TEXT NOT NULL,
  verdict TEXT NOT NULL DEFAULT 'unknown',
  coverage_state TEXT,
  indexing_state TEXT,
  crawled_as TEXT,
  last_crawl_time TIMESTAMP WITH TIME ZONE,
  robots_txt_state TEXT,
  page_fetch_state TEXT,
  rich_results_errors JSONB,
  referring_urls TEXT[],
  raw_response JSONB,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tracked_site_id, page_url)
);

CREATE INDEX idx_indexation_checks_site ON public.indexation_checks(tracked_site_id);
CREATE INDEX idx_indexation_checks_verdict ON public.indexation_checks(verdict);

ALTER TABLE public.indexation_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own indexation checks"
ON public.indexation_checks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own indexation checks"
ON public.indexation_checks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own indexation checks"
ON public.indexation_checks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own indexation checks"
ON public.indexation_checks FOR DELETE
USING (auth.uid() = user_id);
