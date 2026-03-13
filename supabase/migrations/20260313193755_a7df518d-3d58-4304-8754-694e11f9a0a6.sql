
-- Table: gsc_history_log — weekly GSC metrics per tracked site
CREATE TABLE public.gsc_history_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  avg_position numeric,
  week_start_date text NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  top_queries jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gsc_history_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own GSC history"
  ON public.gsc_history_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage GSC history"
  ON public.gsc_history_log FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_gsc_history_site_week ON public.gsc_history_log (tracked_site_id, week_start_date DESC);

-- Table: backlink_snapshots — weekly backlink metrics per tracked site
CREATE TABLE public.backlink_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  domain_rank integer,
  referring_domains integer DEFAULT 0,
  backlinks_total integer DEFAULT 0,
  referring_domains_new integer DEFAULT 0,
  referring_domains_lost integer DEFAULT 0,
  anchor_distribution jsonb DEFAULT '[]'::jsonb,
  week_start_date text NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backlink_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own backlink snapshots"
  ON public.backlink_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage backlink snapshots"
  ON public.backlink_snapshots FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_backlink_snapshots_site_week ON public.backlink_snapshots (tracked_site_id, week_start_date DESC);
