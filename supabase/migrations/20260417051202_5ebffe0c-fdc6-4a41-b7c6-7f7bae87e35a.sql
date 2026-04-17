-- Saturation Intelligence v1
ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS last_cocoon_refresh_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_cms_refresh_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_saturation_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS weekly_refresh_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_tracked_sites_weekly_refresh
  ON public.tracked_sites (weekly_refresh_enabled, last_cocoon_refresh_at NULLS FIRST);

CREATE TABLE IF NOT EXISTS public.saturation_snapshots (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id          UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL,
  snapshot_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  priority_clusters        JSONB NOT NULL DEFAULT '[]'::jsonb,
  topic_n_grams            JSONB NOT NULL DEFAULT '[]'::jsonb,
  type_distribution        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ring_distribution        JSONB NOT NULL DEFAULT '{}'::jsonb,
  semantic_analysis        JSONB NOT NULL DEFAULT '[]'::jsonb,
  llm_models_used          JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_cost_usd       NUMERIC(10,6) DEFAULT 0,
  total_clusters_analyzed  INTEGER DEFAULT 0,
  total_articles_analyzed  INTEGER DEFAULT 0,
  status                   TEXT NOT NULL DEFAULT 'completed',
  error_message            TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saturation_snapshots_site_date
  ON public.saturation_snapshots (tracked_site_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_saturation_snapshots_user_recent
  ON public.saturation_snapshots (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_saturation_snapshots_site_date
  ON public.saturation_snapshots (tracked_site_id, snapshot_date);

ALTER TABLE public.saturation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own saturation snapshots" ON public.saturation_snapshots;
CREATE POLICY "Owners read own saturation snapshots"
  ON public.saturation_snapshots FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Team members read shared saturation snapshots" ON public.saturation_snapshots;
CREATE POLICY "Team members read shared saturation snapshots"
  ON public.saturation_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_team_members atm
      WHERE atm.member_user_id = auth.uid()
        AND atm.owner_user_id  = saturation_snapshots.user_id
    )
  );

DROP POLICY IF EXISTS "Service role writes saturation snapshots" ON public.saturation_snapshots;
CREATE POLICY "Service role writes saturation snapshots"
  ON public.saturation_snapshots FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role updates saturation snapshots" ON public.saturation_snapshots;
CREATE POLICY "Service role updates saturation snapshots"
  ON public.saturation_snapshots FOR UPDATE
  USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_saturation_snapshots_updated_at ON public.saturation_snapshots;
CREATE TRIGGER trg_saturation_snapshots_updated_at
  BEFORE UPDATE ON public.saturation_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;