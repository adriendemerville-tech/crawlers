
-- Table for sectoral observatory aggregated data
CREATE TABLE public.observatory_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector text NOT NULL,
  source text NOT NULL DEFAULT 'expert_audit', -- 'expert_audit', 'strategic_audit', 'crawl'
  period text NOT NULL, -- '2026-03' format YYYY-MM
  total_scans integer NOT NULL DEFAULT 0,
  -- SEO boolean adoption rates (stored as percentages 0-100)
  json_ld_rate numeric DEFAULT 0,
  sitemap_rate numeric DEFAULT 0,
  robots_txt_rate numeric DEFAULT 0,
  meta_description_rate numeric DEFAULT 0,
  open_graph_rate numeric DEFAULT 0,
  canonical_rate numeric DEFAULT 0,
  hreflang_rate numeric DEFAULT 0,
  https_rate numeric DEFAULT 0,
  mobile_friendly_rate numeric DEFAULT 0,
  schema_org_rate numeric DEFAULT 0,
  -- Performance averages
  avg_load_time_ms numeric DEFAULT 0,
  avg_ttfb_ms numeric DEFAULT 0,
  avg_fcp_ms numeric DEFAULT 0,
  avg_lcp_ms numeric DEFAULT 0,
  avg_cls numeric DEFAULT 0,
  -- Content quality
  avg_word_count numeric DEFAULT 0,
  avg_images_without_alt numeric DEFAULT 0,
  avg_broken_links numeric DEFAULT 0,
  avg_seo_score numeric DEFAULT 0,
  -- Strategic insights (from strategic audit)
  avg_eeat_score numeric DEFAULT 0,
  avg_brand_authority numeric DEFAULT 0,
  avg_content_gap_count numeric DEFAULT 0,
  -- Raw aggregation data
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sector, source, period)
);

ALTER TABLE public.observatory_sectors ENABLE ROW LEVEL SECURITY;

-- Public read access (anonymous observatory data)
CREATE POLICY "Anyone can read observatory sectors"
  ON public.observatory_sectors FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service_role can insert/update (via edge functions)
-- No INSERT/UPDATE/DELETE policies for regular users
