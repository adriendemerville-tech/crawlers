CREATE TABLE public.gsc_bigquery_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  gcp_project_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  table_prefix TEXT NOT NULL DEFAULT 'searchdata_site_impression',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  last_verification_status TEXT,
  last_verification_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id)
);

CREATE INDEX idx_gsc_bq_config_site ON public.gsc_bigquery_config(site_id);
CREATE INDEX idx_gsc_bq_config_enabled ON public.gsc_bigquery_config(enabled) WHERE enabled = true;

ALTER TABLE public.gsc_bigquery_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owner can read GSC BQ config"
ON public.gsc_bigquery_config FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.tracked_sites ts WHERE ts.id = gsc_bigquery_config.site_id AND ts.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Site owner can insert GSC BQ config"
ON public.gsc_bigquery_config FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.tracked_sites ts WHERE ts.id = gsc_bigquery_config.site_id AND ts.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Site owner can update GSC BQ config"
ON public.gsc_bigquery_config FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.tracked_sites ts WHERE ts.id = gsc_bigquery_config.site_id AND ts.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Site owner can delete GSC BQ config"
ON public.gsc_bigquery_config FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.tracked_sites ts WHERE ts.id = gsc_bigquery_config.site_id AND ts.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER trg_gsc_bq_config_updated
BEFORE UPDATE ON public.gsc_bigquery_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.gsc_bigquery_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL,
  query_kind TEXT NOT NULL,
  result_payload JSONB NOT NULL,
  bytes_processed BIGINT,
  rows_returned INTEGER,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, query_hash)
);

CREATE INDEX idx_gsc_bq_cache_lookup ON public.gsc_bigquery_cache(site_id, query_hash, expires_at);
CREATE INDEX idx_gsc_bq_cache_expires ON public.gsc_bigquery_cache(expires_at);

ALTER TABLE public.gsc_bigquery_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owner can read GSC BQ cache"
ON public.gsc_bigquery_cache FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.tracked_sites ts WHERE ts.id = gsc_bigquery_cache.site_id AND ts.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);