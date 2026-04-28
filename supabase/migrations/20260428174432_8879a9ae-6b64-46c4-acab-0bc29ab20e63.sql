DO $$ BEGIN
  CREATE TYPE public.site_business_model AS ENUM (
    'saas_b2b', 'saas_b2c',
    'marketplace_b2b', 'marketplace_b2c', 'marketplace_b2b2c',
    'ecommerce_b2c', 'ecommerce_b2b',
    'media_publisher', 'service_local', 'service_agency',
    'leadgen', 'nonprofit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS business_model public.site_business_model,
  ADD COLUMN IF NOT EXISTS business_model_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS business_model_source text CHECK (business_model_source IN ('heuristic','llm','manual')),
  ADD COLUMN IF NOT EXISTS business_model_detected_at timestamptz;

CREATE INDEX IF NOT EXISTS tracked_sites_business_model_idx ON public.tracked_sites(business_model);

COMMENT ON COLUMN public.tracked_sites.business_model IS 'Modèle d''activité (SaaS, Marketplace, E-commerce, Média, Service, etc.) détecté par heuristiques DOM ou LLM, peut être surchargé manuellement.';
COMMENT ON COLUMN public.tracked_sites.business_model_confidence IS 'Score de confiance 0-1 de la détection (1 si manuel).';
COMMENT ON COLUMN public.tracked_sites.business_model_source IS 'heuristic | llm | manual';