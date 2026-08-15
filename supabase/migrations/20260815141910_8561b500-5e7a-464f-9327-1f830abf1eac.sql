CREATE TABLE public.serp_pool (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_normalized text NOT NULL,
  query_raw text NOT NULL,
  engine text NOT NULL DEFAULT 'google',
  country text NOT NULL DEFAULT 'fr',
  language text NOT NULL DEFAULT 'fr',
  device text NOT NULL DEFAULT 'desktop',
  location text NOT NULL DEFAULT '',
  provider text NOT NULL,
  usage_class text NOT NULL DEFAULT 'position',
  organic_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  paa jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_searches jsonb NOT NULL DEFAULT '[]'::jsonb,
  ads_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  knowledge_graph jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw jsonb,
  result_count integer NOT NULL DEFAULT 0,
  cost_usd numeric(10,5) NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX serp_pool_key_uidx ON public.serp_pool (query_normalized, engine, country, language, device, location);
CREATE INDEX serp_pool_expires_idx ON public.serp_pool (expires_at);
CREATE INDEX serp_pool_query_idx ON public.serp_pool (query_normalized);

GRANT SELECT ON public.serp_pool TO authenticated;
GRANT ALL ON public.serp_pool TO service_role;
ALTER TABLE public.serp_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read the shared SERP pool"
ON public.serp_pool FOR SELECT TO authenticated USING (true);

CREATE TABLE public.serp_pool_hits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  serp_pool_id uuid REFERENCES public.serp_pool(id) ON DELETE SET NULL,
  user_id uuid,
  tracked_site_id uuid,
  caller text NOT NULL,
  query_normalized text NOT NULL,
  usage_class text NOT NULL DEFAULT 'position',
  source text NOT NULL,
  provider text,
  cost_usd numeric(10,5) NOT NULL DEFAULT 0,
  saved_usd numeric(10,5) NOT NULL DEFAULT 0,
  fanout_rows integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX serp_pool_hits_user_idx ON public.serp_pool_hits (user_id, created_at DESC);
CREATE INDEX serp_pool_hits_created_idx ON public.serp_pool_hits (created_at DESC);
CREATE INDEX serp_pool_hits_source_idx ON public.serp_pool_hits (source, created_at DESC);

GRANT SELECT ON public.serp_pool_hits TO authenticated;
GRANT ALL ON public.serp_pool_hits TO service_role;
ALTER TABLE public.serp_pool_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own SERP pool hits"
ON public.serp_pool_hits FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_serp_pool_updated_at
BEFORE UPDATE ON public.serp_pool
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.cleanup_serp_pool()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM public.serp_pool WHERE expires_at < now() - interval '7 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  DELETE FROM public.serp_pool_hits WHERE created_at < now() - interval '90 days';
  RETURN deleted;
END;
$$;