-- ═══ Mémoire de marché (ML-ready) ═══
CREATE TABLE public.market_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observed_on DATE NOT NULL DEFAULT (now()::date),
  user_id UUID NOT NULL,
  tracked_site_id UUID,
  domain TEXT NOT NULL,
  domain_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'marina',
  sector_raw TEXT,
  sector_normalized TEXT NOT NULL DEFAULT 'unknown',
  commercial_model TEXT NOT NULL DEFAULT 'unknown',
  entity_type TEXT,
  business_type TEXT,
  is_local_business BOOLEAN,
  target_audience TEXT,
  client_targets JSONB,
  competitors JSONB,
  crawled_pages INTEGER,
  sitemap_pages INTEGER,
  coverage NUMERIC,
  archetype_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
  archetype_verdict TEXT,
  main_problem TEXT,
  avg_seo_score NUMERIC,
  geo_score NUMERIC,
  authority_score NUMERIC,
  CONSTRAINT market_observations_daily_unique UNIQUE (domain_hash, source, observed_on)
);

CREATE INDEX idx_market_obs_sector ON public.market_observations (sector_normalized, commercial_model);
CREATE INDEX idx_market_obs_user ON public.market_observations (user_id, created_at DESC);
CREATE INDEX idx_market_obs_created ON public.market_observations (created_at DESC);

GRANT SELECT ON public.market_observations TO authenticated;
GRANT ALL ON public.market_observations TO service_role;
ALTER TABLE public.market_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own market observations"
  ON public.market_observations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ═══ Benchmarks de mix de gabarits, calibrés sur les observations ═══
CREATE TABLE public.archetype_mix_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_normalized TEXT NOT NULL,
  commercial_model TEXT NOT NULL DEFAULT 'unknown',
  archetype_key TEXT NOT NULL,
  p20 NUMERIC NOT NULL,
  p50 NUMERIC NOT NULL,
  p80 NUMERIC NOT NULL,
  sample_size INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT archetype_mix_benchmarks_key UNIQUE (sector_normalized, commercial_model, archetype_key)
);

GRANT SELECT ON public.archetype_mix_benchmarks TO authenticated;
GRANT ALL ON public.archetype_mix_benchmarks TO service_role;
ALTER TABLE public.archetype_mix_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Benchmarks are readable by authenticated users"
  ON public.archetype_mix_benchmarks FOR SELECT TO authenticated
  USING (true);

-- ═══ Recalcul des fourchettes de référence ═══
CREATE OR REPLACE FUNCTION public.refresh_archetype_mix_benchmarks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  WITH obs AS (
    SELECT o.sector_normalized,
           o.commercial_model,
           k.key AS archetype_key,
           (k.value->>'share')::numeric AS share,
           o.domain_hash
    FROM public.market_observations o,
         jsonb_each(o.archetype_mix) k
    WHERE o.sector_normalized <> 'unknown'
      AND o.created_at > now() - interval '180 days'
      AND jsonb_typeof(k.value) = 'object'
      AND (k.value->>'share') ~ '^[0-9.]+$'
  ),
  per_domain AS (
    -- une valeur par domaine : un site très souvent audité ne doit pas dominer
    SELECT sector_normalized, commercial_model, archetype_key, domain_hash, avg(share) AS share
    FROM obs
    GROUP BY 1, 2, 3, 4
  ),
  agg AS (
    SELECT sector_normalized, commercial_model, archetype_key,
           percentile_cont(0.2) WITHIN GROUP (ORDER BY share) AS p20,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY share) AS p50,
           percentile_cont(0.8) WITHIN GROUP (ORDER BY share) AS p80,
           count(DISTINCT domain_hash)::int AS sample_size
    FROM per_domain
    GROUP BY 1, 2, 3
  )
  INSERT INTO public.archetype_mix_benchmarks
    (sector_normalized, commercial_model, archetype_key, p20, p50, p80, sample_size, updated_at)
  SELECT sector_normalized, commercial_model, archetype_key,
         round(p20, 4), round(p50, 4), round(p80, 4), sample_size, now()
  FROM agg
  WHERE sample_size >= 5
  ON CONFLICT (sector_normalized, commercial_model, archetype_key) DO UPDATE
    SET p20 = EXCLUDED.p20,
        p50 = EXCLUDED.p50,
        p80 = EXCLUDED.p80,
        sample_size = EXCLUDED.sample_size,
        updated_at = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_archetype_mix_benchmarks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_archetype_mix_benchmarks() TO service_role;

-- ═══ Lecture des références applicables à un secteur ═══
CREATE OR REPLACE FUNCTION public.get_archetype_mix_benchmarks(p_sector TEXT, p_model TEXT)
RETURNS TABLE (archetype_key TEXT, p20 NUMERIC, p50 NUMERIC, p80 NUMERIC, sample_size INTEGER, scope TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.archetype_key, b.p20, b.p50, b.p80, b.sample_size,
         CASE WHEN b.commercial_model = coalesce(p_model, 'unknown') THEN 'sector_model' ELSE 'sector' END AS scope
  FROM public.archetype_mix_benchmarks b
  WHERE b.sector_normalized = p_sector
    AND (b.commercial_model = coalesce(p_model, 'unknown') OR b.commercial_model = 'unknown')
  ORDER BY (b.commercial_model = coalesce(p_model, 'unknown')) DESC, b.sample_size DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_archetype_mix_benchmarks(TEXT, TEXT) TO authenticated, service_role;

-- ═══ Recalibration hebdomadaire (dimanche 03h UTC) ═══
SELECT cron.schedule(
  'refresh-archetype-mix-benchmarks',
  '0 3 * * 0',
  $$SELECT public.refresh_archetype_mix_benchmarks();$$
);