
-- Table for persisting parsed sitemap taxonomy per tracked site
CREATE TABLE public.site_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  path_pattern TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT DEFAULT 'unknown',
  page_count INTEGER DEFAULT 0,
  avg_depth NUMERIC(3,1) DEFAULT 0,
  sample_urls TEXT[] DEFAULT '{}',
  confidence NUMERIC(3,2) DEFAULT 0.5,
  source TEXT DEFAULT 'heuristic',
  detected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tracked_site_id, path_pattern)
);

-- Indexes
CREATE INDEX idx_site_taxonomy_tracked_site ON public.site_taxonomy(tracked_site_id);
CREATE INDEX idx_site_taxonomy_domain ON public.site_taxonomy(domain);

-- RLS
ALTER TABLE public.site_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view taxonomy of their tracked sites"
ON public.site_taxonomy FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tracked_sites ts
    WHERE ts.id = site_taxonomy.tracked_site_id
    AND ts.user_id = auth.uid()
  )
);

CREATE POLICY "Service role full access on site_taxonomy"
ON public.site_taxonomy FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Global pattern learning table for cross-site ML/heuristic improvement
CREATE TABLE public.taxonomy_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_segment TEXT NOT NULL,
  inferred_category TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  confidence NUMERIC(3,2) DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(path_segment, inferred_category)
);

ALTER TABLE public.taxonomy_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on taxonomy_patterns"
ON public.taxonomy_patterns FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_site_taxonomy_updated_at
  BEFORE UPDATE ON public.site_taxonomy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_taxonomy_patterns_updated_at
  BEFORE UPDATE ON public.taxonomy_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
