CREATE TABLE IF NOT EXISTS public.competitive_ratio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  period_month date NOT NULL,
  tracked_site_id uuid,
  user_id uuid,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, period_month)
);

CREATE INDEX IF NOT EXISTS idx_crs_site_period ON public.competitive_ratio_snapshots (tracked_site_id, period_month DESC);

GRANT SELECT ON public.competitive_ratio_snapshots TO authenticated;
GRANT ALL ON public.competitive_ratio_snapshots TO service_role;

ALTER TABLE public.competitive_ratio_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crs_select_own" ON public.competitive_ratio_snapshots;
CREATE POLICY "crs_select_own" ON public.competitive_ratio_snapshots
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "crs_service_all" ON public.competitive_ratio_snapshots;
CREATE POLICY "crs_service_all" ON public.competitive_ratio_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);