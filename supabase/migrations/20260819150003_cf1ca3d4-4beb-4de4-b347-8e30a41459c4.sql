CREATE TABLE IF NOT EXISTS public.domain_authority_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  snapshot_month text NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  authority_score integer,
  domain_rank integer,
  domain_rank_raw integer,
  referring_domains integer,
  referring_main_domains integer,
  backlinks_total integer,
  dofollow_ratio integer,
  broken_backlinks integer,
  toxicity_score integer,
  toxicity_verdict text,
  distribution jsonb,
  top_anchors jsonb,
  history jsonb,
  history_fetched_at timestamptz,
  confidence text,
  calibration_version integer,
  source text NOT NULL DEFAULT 'dataforseo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_authority_snapshots_domain_month_key UNIQUE (domain, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_domain_authority_snapshots_domain_measured
  ON public.domain_authority_snapshots (domain, measured_at DESC);

GRANT SELECT ON public.domain_authority_snapshots TO authenticated;
GRANT ALL ON public.domain_authority_snapshots TO service_role;

ALTER TABLE public.domain_authority_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read authority snapshots" ON public.domain_authority_snapshots;
CREATE POLICY "Authenticated users can read authority snapshots"
ON public.domain_authority_snapshots
FOR SELECT
TO authenticated
USING (true);

DROP TRIGGER IF EXISTS update_domain_authority_snapshots_updated_at ON public.domain_authority_snapshots;
CREATE TRIGGER update_domain_authority_snapshots_updated_at
BEFORE UPDATE ON public.domain_authority_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();