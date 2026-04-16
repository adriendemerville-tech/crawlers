-- Vague 4: Alertes pipeline + activation pilote IKtracker

-- 1. Table d'alertes
CREATE TABLE IF NOT EXISTS public.editorial_pipeline_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('cost_spike', 'latency_spike', 'error_rate', 'fallback_used')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  threshold_value NUMERIC,
  observed_value NUMERIC,
  message TEXT NOT NULL,
  pipeline_run_id UUID,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editorial_alerts_user_unack 
  ON public.editorial_pipeline_alerts(user_id, is_acknowledged, created_at DESC);

ALTER TABLE public.editorial_pipeline_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their pipeline alerts"
  ON public.editorial_pipeline_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages pipeline alerts"
  ON public.editorial_pipeline_alerts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users acknowledge their alerts"
  ON public.editorial_pipeline_alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Activation pilote IKtracker (seed)
-- On active use_editorial_pipeline pour iktracker.fr s'il existe une config
UPDATE public.autopilot_configs
SET use_editorial_pipeline = true,
    updated_at = now()
WHERE tracked_site_id IN (
  SELECT id FROM public.tracked_sites 
  WHERE domain ILIKE '%iktracker%'
);

-- 3. Vue agrégée pour le badge "Pipeline actif" (lit-only via RLS)
CREATE OR REPLACE VIEW public.editorial_pipeline_status AS
SELECT 
  ac.user_id,
  ac.tracked_site_id,
  ts.domain,
  ac.use_editorial_pipeline,
  COUNT(epl.id) FILTER (WHERE epl.created_at > now() - interval '7 days') AS runs_last_7d,
  COALESCE(AVG(epl.latency_ms) FILTER (WHERE epl.created_at > now() - interval '7 days'), 0) AS avg_latency_ms_7d,
  COALESCE(SUM(epl.cost_usd) FILTER (WHERE epl.created_at > now() - interval '7 days'), 0) AS total_cost_usd_7d
FROM public.autopilot_configs ac
JOIN public.tracked_sites ts ON ts.id = ac.tracked_site_id
LEFT JOIN public.editorial_pipeline_logs epl ON epl.domain = ts.domain AND epl.user_id = ac.user_id
GROUP BY ac.user_id, ac.tracked_site_id, ts.domain, ac.use_editorial_pipeline;

GRANT SELECT ON public.editorial_pipeline_status TO authenticated;