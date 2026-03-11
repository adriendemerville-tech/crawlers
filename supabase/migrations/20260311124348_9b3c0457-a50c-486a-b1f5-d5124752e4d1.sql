
-- Table principale des crawls
CREATE TABLE public.site_crawls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_pages INTEGER NOT NULL DEFAULT 0,
  crawled_pages INTEGER NOT NULL DEFAULT 0,
  avg_score NUMERIC DEFAULT NULL,
  ai_summary TEXT DEFAULT NULL,
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  credits_used INTEGER NOT NULL DEFAULT 0,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

-- Table des pages individuelles crawlées
CREATE TABLE public.crawl_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id UUID NOT NULL REFERENCES public.site_crawls(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  http_status INTEGER DEFAULT NULL,
  title TEXT DEFAULT NULL,
  meta_description TEXT DEFAULT NULL,
  h1 TEXT DEFAULT NULL,
  has_schema_org BOOLEAN DEFAULT false,
  has_canonical BOOLEAN DEFAULT false,
  has_hreflang BOOLEAN DEFAULT false,
  has_og BOOLEAN DEFAULT false,
  word_count INTEGER DEFAULT 0,
  images_total INTEGER DEFAULT 0,
  images_without_alt INTEGER DEFAULT 0,
  internal_links INTEGER DEFAULT 0,
  external_links INTEGER DEFAULT 0,
  broken_links JSONB DEFAULT '[]'::jsonb,
  seo_score INTEGER DEFAULT NULL,
  issues JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.site_crawls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own crawls" ON public.site_crawls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create crawls" ON public.site_crawls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own crawls" ON public.site_crawls FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own crawls" ON public.site_crawls FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view crawl pages" ON public.crawl_pages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.site_crawls sc WHERE sc.id = crawl_pages.crawl_id AND sc.user_id = auth.uid())
);
CREATE POLICY "Service can insert crawl pages" ON public.crawl_pages FOR INSERT WITH CHECK (true);

-- Index pour perf
CREATE INDEX idx_site_crawls_user_id ON public.site_crawls(user_id);
CREATE INDEX idx_crawl_pages_crawl_id ON public.crawl_pages(crawl_id);
