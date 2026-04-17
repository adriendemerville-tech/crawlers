-- Sprint 2 GEO : ingestion bot_hits + bouclier Cloudflare

-- ── 1. Table bot_hits ──
CREATE TABLE IF NOT EXISTS public.bot_hits (
  id BIGSERIAL PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  hit_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  url TEXT NOT NULL,
  path TEXT,
  user_agent TEXT,
  bot_family TEXT,
  bot_name TEXT,
  is_ai_bot BOOLEAN NOT NULL DEFAULT false,
  is_human_sample BOOLEAN NOT NULL DEFAULT false,
  status_code INTEGER,
  country TEXT,
  ip_hash TEXT,
  referer TEXT,
  cf_ray TEXT,
  raw_meta JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bot_hits_site_time ON public.bot_hits (tracked_site_id, hit_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_hits_site_aibot_time ON public.bot_hits (tracked_site_id, is_ai_bot, hit_at DESC) WHERE is_ai_bot = true;
CREATE INDEX IF NOT EXISTS idx_bot_hits_site_path ON public.bot_hits (tracked_site_id, path);
CREATE INDEX IF NOT EXISTS idx_bot_hits_user ON public.bot_hits (user_id, hit_at DESC);

ALTER TABLE public.bot_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bot hits"
  ON public.bot_hits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages bot hits"
  ON public.bot_hits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 2. Table cf_shield_configs ──
CREATE TABLE IF NOT EXISTS public.cf_shield_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL UNIQUE REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,

  -- Cloudflare credentials (encrypted)
  cf_token_encrypted TEXT,
  cf_account_id TEXT,
  cf_zone_id TEXT,
  cf_worker_name TEXT,
  cf_route_pattern TEXT,

  -- Deployment
  deployment_mode TEXT NOT NULL DEFAULT 'auto', -- 'auto' | 'manual'
  status TEXT NOT NULL DEFAULT 'pending',       -- 'pending' | 'active' | 'error' | 'paused'
  last_error TEXT,
  last_verified_at TIMESTAMPTZ,
  deployed_at TIMESTAMPTZ,

  -- Sampling adaptive (par plan)
  human_sample_rate NUMERIC NOT NULL DEFAULT 0.001,
  ingestion_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Stats
  hits_total BIGINT DEFAULT 0,
  hits_last_24h BIGINT DEFAULT 0,
  last_hit_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cf_shield_user ON public.cf_shield_configs (user_id);
CREATE INDEX IF NOT EXISTS idx_cf_shield_status ON public.cf_shield_configs (status);

ALTER TABLE public.cf_shield_configs ENABLE ROW LEVEL SECURITY;

-- Users see their config but NEVER the token (use the secure view)
CREATE POLICY "Service role manages CF shield configs"
  ON public.cf_shield_configs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can update their own CF shield config metadata"
  ON public.cf_shield_configs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own CF shield config"
  ON public.cf_shield_configs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Revoke direct SELECT on base table (token must never leak)
REVOKE SELECT ON public.cf_shield_configs FROM authenticated, anon;

-- ── 3. Secure view (no token) ──
CREATE OR REPLACE VIEW public.cf_shield_configs_safe
WITH (security_invoker = true)
AS
SELECT
  id, tracked_site_id, user_id, domain,
  cf_account_id, cf_zone_id, cf_worker_name, cf_route_pattern,
  deployment_mode, status, last_error, last_verified_at, deployed_at,
  human_sample_rate,
  hits_total, hits_last_24h, last_hit_at,
  created_at, updated_at,
  -- Surface a flag only, never the token
  (cf_token_encrypted IS NOT NULL) AS has_token
FROM public.cf_shield_configs
WHERE auth.uid() = user_id;

GRANT SELECT ON public.cf_shield_configs_safe TO authenticated;

-- ── 4. Trigger updated_at ──
CREATE TRIGGER update_cf_shield_configs_updated_at
  BEFORE UPDATE ON public.cf_shield_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 5. Function: resolve sampling rate per plan ──
CREATE OR REPLACE FUNCTION public.resolve_human_sample_rate(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
BEGIN
  SELECT plan_type INTO v_plan FROM profiles WHERE user_id = p_user_id;
  RETURN CASE
    WHEN v_plan = 'agency_premium' THEN 0.05  -- 5%
    WHEN v_plan = 'agency_pro' THEN 0.01      -- 1%
    ELSE 0.001                                -- 0.1% (free / new)
  END;
END;
$$;

-- ── 6. Function: aggregate KPIs for geo-kpis-aggregate (called by the edge fn) ──
CREATE OR REPLACE FUNCTION public.compute_ai_traffic_ratio(p_tracked_site_id UUID, p_window_days INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ai_hits BIGINT;
  v_human_sampled BIGINT;
  v_sample_rate NUMERIC;
  v_estimated_humans BIGINT;
  v_ratio NUMERIC;
BEGIN
  SELECT COUNT(*) FILTER (WHERE is_ai_bot = true),
         COUNT(*) FILTER (WHERE is_human_sample = true)
  INTO v_ai_hits, v_human_sampled
  FROM bot_hits
  WHERE tracked_site_id = p_tracked_site_id
    AND hit_at > now() - (p_window_days || ' days')::interval;

  SELECT human_sample_rate INTO v_sample_rate
  FROM cf_shield_configs WHERE tracked_site_id = p_tracked_site_id;

  v_sample_rate := COALESCE(v_sample_rate, 0.001);
  v_estimated_humans := CASE WHEN v_sample_rate > 0 THEN ROUND(v_human_sampled / v_sample_rate) ELSE 0 END;
  v_ratio := CASE WHEN v_estimated_humans > 0 THEN ROUND((v_ai_hits::numeric / v_estimated_humans::numeric) * 100, 2) ELSE NULL END;

  RETURN jsonb_build_object(
    'ai_hits', v_ai_hits,
    'humans_sampled', v_human_sampled,
    'humans_estimated', v_estimated_humans,
    'sample_rate', v_sample_rate,
    'ai_per_100_visits', v_ratio,
    'window_days', p_window_days
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_ai_traffic_ratio(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_human_sample_rate(UUID) TO authenticated, service_role;