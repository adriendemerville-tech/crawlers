-- ── 1. Colonnes d'invalidation événementielle sur tracked_sites ─────────────
ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS last_audit_invalidated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_cocoon_invalidated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tracked_sites.last_audit_invalidated_at IS
  'Posé par triggers (publi CMS confirmée, anomaly down) ou par Parménion lui-même quand un audit est consommé. Si > last audit_run_at → audit obligatoire.';
COMMENT ON COLUMN public.tracked_sites.last_cocoon_invalidated_at IS
  'Posé par triggers quand des publications confirmées s''accumulent. Si > last cocoon_run_at → diagnose obligatoire.';

-- ── 2. Trigger : publi CMS confirmée (content_deploy_snapshots OK) ────────
CREATE OR REPLACE FUNCTION public.invalidate_audit_on_deploy_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Déclenche uniquement quand la vérification passe à 'ok' (publi confirmée live)
  IF NEW.last_verification_status = 'ok'
     AND COALESCE(OLD.last_verification_status, '') IS DISTINCT FROM 'ok'
     AND NEW.tracked_site_id IS NOT NULL
  THEN
    UPDATE public.tracked_sites
       SET last_audit_invalidated_at  = now(),
           last_cocoon_invalidated_at = now()
     WHERE id = NEW.tracked_site_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_audit_on_deploy_verified ON public.content_deploy_snapshots;
CREATE TRIGGER trg_invalidate_audit_on_deploy_verified
AFTER INSERT OR UPDATE OF last_verification_status ON public.content_deploy_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_audit_on_deploy_verified();

-- ── 3. Trigger : alerte Drop Detector (anomaly_alerts direction down) ─────
CREATE OR REPLACE FUNCTION public.invalidate_audit_on_anomaly_down()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'down'
     AND NEW.tracked_site_id IS NOT NULL
     AND COALESCE(NEW.is_dismissed, false) = false
  THEN
    UPDATE public.tracked_sites
       SET last_audit_invalidated_at  = now(),
           last_cocoon_invalidated_at = now()
     WHERE id = NEW.tracked_site_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_audit_on_anomaly_down ON public.anomaly_alerts;
CREATE TRIGGER trg_invalidate_audit_on_anomaly_down
AFTER INSERT ON public.anomaly_alerts
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_audit_on_anomaly_down();

-- ── 4. Helper : décide si Parménion peut sauter une phase ─────────────────
-- Phases supportées : 'audit' (TTL 5j) et 'diagnose' (TTL 5j + min 3 publi confirmées)
CREATE OR REPLACE FUNCTION public.parmenion_should_skip_phase(
  p_domain TEXT,
  p_phase  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site_id              UUID;
  v_invalidated_at       TIMESTAMPTZ;
  v_last_phase_at        TIMESTAMPTZ;
  v_ttl_interval         INTERVAL;
  v_publi_count          INTEGER := 0;
  v_min_publi            INTEGER;
  v_can_skip             BOOLEAN := false;
  v_reason               TEXT;
BEGIN
  SELECT id INTO v_site_id
    FROM public.tracked_sites
   WHERE lower(domain) = lower(p_domain)
   LIMIT 1;
  IF v_site_id IS NULL THEN
    RETURN jsonb_build_object('skip', false, 'reason', 'site_not_found');
  END IF;

  -- TTL = 5 jours pour les deux phases
  v_ttl_interval := interval '5 days';

  -- Marqueur d'invalidation de la phase
  IF p_phase = 'audit' THEN
    SELECT last_audit_invalidated_at INTO v_invalidated_at
      FROM public.tracked_sites WHERE id = v_site_id;
  ELSIF p_phase = 'diagnose' THEN
    SELECT last_cocoon_invalidated_at INTO v_invalidated_at
      FROM public.tracked_sites WHERE id = v_site_id;
  ELSE
    RETURN jsonb_build_object('skip', false, 'reason', 'unsupported_phase');
  END IF;

  -- Date de dernière exécution complétée de la phase
  SELECT MAX(created_at) INTO v_last_phase_at
    FROM public.parmenion_decision_log
   WHERE domain = p_domain
     AND pipeline_phase = p_phase
     AND status IN ('completed', 'dry_run');

  -- Aucune exécution passée → impossible de skip
  IF v_last_phase_at IS NULL THEN
    RETURN jsonb_build_object('skip', false, 'reason', 'no_prior_run');
  END IF;

  -- Invalidation événementielle postérieure → impossible de skip
  IF v_invalidated_at IS NOT NULL AND v_invalidated_at > v_last_phase_at THEN
    RETURN jsonb_build_object(
      'skip', false,
      'reason', 'invalidated_by_event',
      'invalidated_at', v_invalidated_at,
      'last_phase_at', v_last_phase_at
    );
  END IF;

  -- TTL non expiré ?
  IF (now() - v_last_phase_at) >= v_ttl_interval THEN
    RETURN jsonb_build_object(
      'skip', false,
      'reason', 'ttl_expired',
      'last_phase_at', v_last_phase_at,
      'ttl_days', 5
    );
  END IF;

  v_can_skip := true;
  v_reason := 'ttl_fresh';

  -- Pour diagnose : exiger < 3 publications confirmées depuis le dernier diagnose
  IF p_phase = 'diagnose' THEN
    v_min_publi := 3;

    SELECT COUNT(*) INTO v_publi_count
      FROM public.content_deploy_snapshots
     WHERE tracked_site_id = v_site_id
       AND last_verification_status = 'ok'
       AND COALESCE(last_verified_at, updated_at) > v_last_phase_at;

    IF v_publi_count >= v_min_publi THEN
      v_can_skip := false;
      v_reason := 'publi_threshold_reached';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'skip', v_can_skip,
    'reason', v_reason,
    'last_phase_at', v_last_phase_at,
    'invalidated_at', v_invalidated_at,
    'publi_since', v_publi_count,
    'ttl_days', 5
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.parmenion_should_skip_phase(TEXT, TEXT) TO authenticated, service_role;