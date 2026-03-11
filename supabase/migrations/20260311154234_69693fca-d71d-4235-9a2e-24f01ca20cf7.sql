
CREATE TABLE public.audit_impact_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tracked_site_id uuid REFERENCES public.tracked_sites(id) ON DELETE SET NULL,
  domain text NOT NULL,
  url text NOT NULL,
  audit_type text NOT NULL,
  audit_report_id uuid,

  -- Audit scores at snapshot time
  audit_scores jsonb NOT NULL DEFAULT '{}',
  recommendations_count integer DEFAULT 0,
  recommendations_data jsonb DEFAULT '[]',

  -- GSC metrics at snapshot time (T0)
  gsc_baseline jsonb,
  -- GSC metrics at T+30
  gsc_t30 jsonb,
  gsc_t30_measured_at timestamptz,
  -- GSC metrics at T+60
  gsc_t60 jsonb,
  gsc_t60_measured_at timestamptz,
  -- GSC metrics at T+90
  gsc_t90 jsonb,
  gsc_t90_measured_at timestamptz,

  -- Recommendations applied tracking
  recos_applied_count integer DEFAULT 0,
  recos_applied_data jsonb DEFAULT '[]',
  corrective_code_deployed boolean DEFAULT false,
  action_plan_progress numeric DEFAULT 0,

  -- Computed correlation
  impact_score numeric,
  reliability_grade text,
  correlation_data jsonb DEFAULT '{}',

  -- External enrichment
  dataforseo_baseline jsonb,
  dataforseo_t90 jsonb,
  pagespeed_baseline jsonb,
  pagespeed_t90 jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  next_measurement_at timestamptz,
  measurement_phase text DEFAULT 'baseline'
);

ALTER TABLE public.audit_impact_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own snapshots"
  ON public.audit_impact_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all snapshots"
  ON public.audit_impact_snapshots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_snapshots_domain ON public.audit_impact_snapshots(domain);
CREATE INDEX idx_snapshots_phase ON public.audit_impact_snapshots(measurement_phase)
  WHERE measurement_phase != 'complete';
CREATE INDEX idx_snapshots_next_measurement ON public.audit_impact_snapshots(next_measurement_at)
  WHERE measurement_phase != 'complete';
CREATE INDEX idx_snapshots_user ON public.audit_impact_snapshots(user_id);
