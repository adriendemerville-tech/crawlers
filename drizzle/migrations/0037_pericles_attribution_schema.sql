ALTER TABLE public.pericles_decision_log
  ADD COLUMN IF NOT EXISTS market_context text,
  ADD COLUMN IF NOT EXISTS competitive_measured_at timestamptz,
  ADD COLUMN IF NOT EXISTS geo_reward_signal numeric,
  ADD COLUMN IF NOT EXISTS geo_measured_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw_reward_signal numeric;

ALTER TABLE public.geo_visibility_snapshots
  ADD COLUMN IF NOT EXISTS pericles_decision_id uuid REFERENCES public.pericles_decision_log(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_geo_snapshots_pericles_decision
  ON public.geo_visibility_snapshots (pericles_decision_id, measurement_phase);

ALTER TABLE public.architect_workbench
  ADD COLUMN IF NOT EXISTS pericles_decision_id uuid,
  ADD COLUMN IF NOT EXISTS measurement_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS reward_verdict text,
  ADD COLUMN IF NOT EXISTS reward_verdict_reason text,
  ADD COLUMN IF NOT EXISTS reward_verdict_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_workbench_pericles_decision
  ON public.architect_workbench (pericles_decision_id);

CREATE TABLE IF NOT EXISTS public.pericles_competitive_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES public.pericles_decision_log(id) ON DELETE CASCADE,
  user_id uuid,
  domain text NOT NULL,
  keyword text NOT NULL,
  our_position integer,
  our_previous_position integer,
  top_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  gainers jsonb NOT NULL DEFAULT '[]'::jsonb,
  serp_source text,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pericles_comp_snap_decision
  ON public.pericles_competitive_snapshots (decision_id);

GRANT SELECT ON public.pericles_competitive_snapshots TO authenticated;
GRANT ALL ON public.pericles_competitive_snapshots TO service_role;

ALTER TABLE public.pericles_competitive_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own competitive snapshots" ON public.pericles_competitive_snapshots;
CREATE POLICY "own competitive snapshots"
  ON public.pericles_competitive_snapshots
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service manages competitive snapshots" ON public.pericles_competitive_snapshots;
CREATE POLICY "service manages competitive snapshots"
  ON public.pericles_competitive_snapshots
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.pericles_apply_market_context(
  p_decision_id uuid,
  p_market_context text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE pericles_decision_log
  SET raw_reward_signal = COALESCE(raw_reward_signal, reward_signal),
      market_context = p_market_context,
      competitive_measured_at = now(),
      reward_signal = CASE WHEN p_market_context = 'competitor_gain' THEN 0 ELSE reward_signal END
  WHERE id = p_decision_id AND market_context IS NULL;

  UPDATE architect_workbench
  SET reward_verdict = CASE WHEN p_market_context = 'competitor_gain' THEN 'market_loss' ELSE 'regressed' END,
      reward_verdict_reason = CASE
        WHEN p_market_context = 'competitor_gain'
          THEN 'Recul constaté mais un concurrent a gagné la position : perte attribuée au marché.'
        ELSE 'Recul constaté sans gagnant identifié : perte propre conservée.'
      END,
      reward_verdict_at = now()
  WHERE pericles_decision_id = p_decision_id AND reward_verdict = 'pending_measure';
END;
$$;

REVOKE ALL ON FUNCTION public.pericles_apply_market_context(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.pericles_apply_market_context(uuid, text) TO service_role;