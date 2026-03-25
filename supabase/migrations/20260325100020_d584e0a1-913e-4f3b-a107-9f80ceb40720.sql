
-- Table dédiée pour centraliser les résultats Marina structurés pour l'entraînement ML
CREATE TABLE public.marina_training_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  domain text NOT NULL,
  url text NOT NULL,
  language text DEFAULT 'fr',
  
  -- SEO scores
  seo_total_score integer,
  seo_max_score integer,
  seo_performance_score integer,
  seo_technical_score integer,
  seo_semantic_score integer,
  seo_ai_ready_score integer,
  seo_security_score integer,
  
  -- Strategic GEO scores
  geo_overall_score integer,
  geo_scores jsonb DEFAULT '{}',
  
  -- Cocoon data
  cocoon_nodes_count integer,
  cocoon_clusters_count integer,
  
  -- Raw signals for feature engineering
  has_schema_org boolean,
  has_robots_txt boolean,
  is_https boolean,
  word_count integer,
  broken_links_count integer,
  psi_performance integer,
  psi_seo integer,
  lcp_ms numeric,
  cls numeric,
  tbt_ms numeric,
  
  -- Site profile
  site_type text,
  cms_detected text,
  is_spa boolean,
  
  -- Full raw data for deep analysis
  raw_seo_data jsonb DEFAULT '{}',
  raw_geo_data jsonb DEFAULT '{}',
  raw_cocoon_data jsonb DEFAULT '{}',
  
  -- Metadata
  report_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT marina_training_data_job_id_unique UNIQUE (job_id)
);

-- Index for fast queries by domain and date
CREATE INDEX idx_marina_training_domain ON public.marina_training_data (domain);
CREATE INDEX idx_marina_training_created ON public.marina_training_data (created_at DESC);

-- RLS: admin-only access
ALTER TABLE public.marina_training_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage training data"
  ON public.marina_training_data
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
