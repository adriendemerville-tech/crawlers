
-- Table for storing AI-generated auto-links with reversibility
CREATE TABLE public.cocoon_auto_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT NOT NULL,
  context_sentence TEXT,
  confidence NUMERIC(3,2) DEFAULT 0.5,
  is_deployed BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  deployment_method TEXT DEFAULT 'script_injection',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tracked_site_id, source_url, target_url)
);

-- Page-level linking exclusion preferences
CREATE TABLE public.cocoon_linking_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  exclude_as_source BOOLEAN DEFAULT false,
  exclude_as_target BOOLEAN DEFAULT false,
  exclude_all BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tracked_site_id, page_url)
);

-- RLS
ALTER TABLE public.cocoon_auto_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cocoon_linking_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own auto links" ON public.cocoon_auto_links
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own exclusions" ON public.cocoon_linking_exclusions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_auto_links_site ON public.cocoon_auto_links(tracked_site_id);
CREATE INDEX idx_auto_links_source ON public.cocoon_auto_links(source_url);
CREATE INDEX idx_linking_exclusions_site ON public.cocoon_linking_exclusions(tracked_site_id);
