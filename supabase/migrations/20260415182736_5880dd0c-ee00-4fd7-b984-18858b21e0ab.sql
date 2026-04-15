
-- Table for tracking competitor URLs per tracked site
CREATE TABLE public.competitor_tracked_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  competitor_url TEXT NOT NULL,
  competitor_domain TEXT NOT NULL,
  label TEXT,
  crawl_status TEXT NOT NULL DEFAULT 'pending',
  last_crawl_at TIMESTAMP WITH TIME ZONE,
  seo_score INTEGER,
  geo_score INTEGER,
  serp_positions JSONB DEFAULT '[]'::jsonb,
  semantic_relevance JSONB DEFAULT '{}'::jsonb,
  crawl_data JSONB DEFAULT '{}'::jsonb,
  audit_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tracked_site_id, competitor_url)
);

-- Enable RLS
ALTER TABLE public.competitor_tracked_urls ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own competitor URLs"
  ON public.competitor_tracked_urls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own competitor URLs"
  ON public.competitor_tracked_urls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own competitor URLs"
  ON public.competitor_tracked_urls FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own competitor URLs"
  ON public.competitor_tracked_urls FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_competitor_tracked_urls_site ON public.competitor_tracked_urls(tracked_site_id);
CREATE INDEX idx_competitor_tracked_urls_user ON public.competitor_tracked_urls(user_id);

-- Updated_at trigger
CREATE TRIGGER update_competitor_tracked_urls_updated_at
  BEFORE UPDATE ON public.competitor_tracked_urls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
