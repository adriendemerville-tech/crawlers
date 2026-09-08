
-- Renommage Parmenion (autopilot) → Périclès, voie additive zéro-downtime.
-- Les anciennes tables restent en place ; le code bascule sur les nouvelles.

ALTER TYPE public.parmenion_throttle_period RENAME TO pericles_throttle_period;

CREATE TABLE public.pericles_targets (LIKE public.parmenion_targets INCLUDING ALL);
CREATE TABLE public.pericles_decision_log (LIKE public.parmenion_decision_log INCLUDING ALL);
CREATE TABLE public.pericles_targeting_lenses (LIKE public.parmenion_targeting_lenses INCLUDING ALL);

INSERT INTO public.pericles_targets SELECT * FROM public.parmenion_targets;
INSERT INTO public.pericles_decision_log SELECT * FROM public.parmenion_decision_log;
INSERT INTO public.pericles_targeting_lenses SELECT * FROM public.parmenion_targeting_lenses;

ALTER TABLE public.pericles_decision_log
  ADD CONSTRAINT pericles_decision_log_tracked_site_id_fkey
  FOREIGN KEY (tracked_site_id) REFERENCES public.tracked_sites(id) ON DELETE CASCADE;
ALTER TABLE public.pericles_targeting_lenses
  ADD CONSTRAINT pericles_targeting_lenses_target_id_fkey
  FOREIGN KEY (target_id) REFERENCES public.pericles_targets(id) ON DELETE CASCADE;
ALTER TABLE public.pericles_targets
  ADD CONSTRAINT pericles_targets_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pericles_targets TO authenticated;
GRANT ALL ON public.pericles_targets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pericles_targeting_lenses TO authenticated;
GRANT ALL ON public.pericles_targeting_lenses TO service_role;
GRANT SELECT ON public.pericles_decision_log TO authenticated;
GRANT ALL ON public.pericles_decision_log TO service_role;

ALTER TABLE public.pericles_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pericles_targeting_lenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pericles_decision_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all targets" ON public.pericles_targets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create targets" ON public.pericles_targets FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update targets" ON public.pericles_targets FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete targets" ON public.pericles_targets FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view lenses" ON public.pericles_targeting_lenses FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create lenses" ON public.pericles_targeting_lenses FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update lenses" ON public.pericles_targeting_lenses FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete lenses" ON public.pericles_targeting_lenses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages decisions" ON public.pericles_decision_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view own decisions" ON public.pericles_decision_log FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pericles_targets_updated_at BEFORE UPDATE ON public.pericles_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pericles_log_updated_at BEFORE UPDATE ON public.pericles_decision_log FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pericles_targeting_lenses_updated_at BEFORE UPDATE ON public.pericles_targeting_lenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auto_create_autopilot_config AFTER INSERT OR UPDATE OF is_active, autopilot_enabled, domain ON public.pericles_targets FOR EACH ROW EXECUTE FUNCTION auto_create_autopilot_config_for_target();

-- Index partiel pour le ON CONFLICT des connexions gérées par Périclès
CREATE UNIQUE INDEX IF NOT EXISTS cms_connections_pericles_site_platform_uniq
  ON public.cms_connections (tracked_site_id, platform) WHERE managed_by = 'pericles';

-- ===== Fonctions renommées =====

CREATE OR REPLACE FUNCTION public.get_pericles_author_aliases(p_domain text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(author_aliases, '[]'::jsonb)
  FROM public.pericles_targets
  WHERE lower(domain) = lower(p_domain)
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_pericles_target_api_key(p_domain text)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT api_key_name
  FROM public.pericles_targets
  WHERE domain = p_domain AND is_active = true
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.pericles_error_rate(p_domain text, p_last_n integer DEFAULT 10)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH recent AS (
    SELECT is_error
    FROM pericles_decision_log
    WHERE domain = p_domain
      AND status = 'completed'
      AND measured_at IS NOT NULL
    ORDER BY created_at DESC
    LIMIT p_last_n
  )
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'errors', COUNT(*) FILTER (WHERE is_error),
    'error_rate', CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE is_error)::numeric / COUNT(*)::numeric * 100, 1)
      ELSE 0 END,
    'conservative_mode', CASE WHEN COUNT(*) >= 5 AND
      (COUNT(*) FILTER (WHERE is_error)::numeric / COUNT(*)::numeric * 100) > 20
      THEN true ELSE false END
  )
  FROM recent;
$function$;

CREATE OR REPLACE FUNCTION public.pericles_recent_errors(p_domain text, p_limit integer DEFAULT 5)
 RETURNS TABLE(cycle_number integer, goal_description text, action_type text, risk_predicted integer, risk_calibrated integer, impact_predicted text, impact_actual text, calibration_note text, error_category text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT cycle_number, goal_description, action_type,
         risk_predicted, risk_calibrated, impact_predicted,
         impact_actual, calibration_note, error_category
  FROM pericles_decision_log
  WHERE domain = p_domain AND is_error = true
  ORDER BY created_at DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.pericles_rotate_pull_token(_target_id uuid)
 RETURNS TABLE(token text, prefix text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _new_token text;
  _prefix text;
  _hash text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can rotate pull tokens';
  END IF;
  _new_token := 'prc_live_' || encode(extensions.gen_random_bytes(20), 'hex');
  _prefix := substring(_new_token, 1, 16);
  _hash := encode(extensions.digest(_new_token, 'sha256'), 'hex');
  UPDATE public.pericles_targets
  SET pull_token_hash = _hash,
      pull_token_prefix = _prefix,
      pull_token_created_at = now(),
      updated_at = now()
  WHERE id = _target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target not found';
  END IF;
  RETURN QUERY SELECT _new_token, _prefix;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pericles_verify_pull_token(_token text)
 RETURNS TABLE(target_id uuid, domain text, is_active boolean, autopilot_enabled boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
  SELECT id, domain, is_active, autopilot_enabled
  FROM public.pericles_targets
  WHERE pull_token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.pericles_should_skip_phase(p_domain text, p_phase text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  v_ttl_interval := interval '5 days';
  IF p_phase = 'audit' THEN
    SELECT last_audit_invalidated_at INTO v_invalidated_at
      FROM public.tracked_sites WHERE id = v_site_id;
  ELSIF p_phase = 'diagnose' THEN
    SELECT last_cocoon_invalidated_at INTO v_invalidated_at
      FROM public.tracked_sites WHERE id = v_site_id;
  ELSE
    RETURN jsonb_build_object('skip', false, 'reason', 'unsupported_phase');
  END IF;
  SELECT MAX(created_at) INTO v_last_phase_at
    FROM public.pericles_decision_log
   WHERE domain = p_domain
     AND pipeline_phase = p_phase
     AND status IN ('completed', 'dry_run');
  IF v_last_phase_at IS NULL THEN
    RETURN jsonb_build_object('skip', false, 'reason', 'no_prior_run');
  END IF;
  IF v_invalidated_at IS NOT NULL AND v_invalidated_at > v_last_phase_at THEN
    RETURN jsonb_build_object(
      'skip', false,
      'reason', 'invalidated_by_event',
      'invalidated_at', v_invalidated_at,
      'last_phase_at', v_last_phase_at
    );
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_stale_pericles_decisions(p_hours integer DEFAULT 3)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE pericles_decision_log
    SET status = 'skipped_stale',
        execution_error = COALESCE(execution_error, 'Cycle interrompu (timeout) — réconciliation globale'),
        updated_at = now()
    WHERE status = 'planned'
      AND created_at < now() - make_interval(hours => GREATEST(1, p_hours))
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_pericles_target_to_cms_connection()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_site RECORD;
  v_platform public.cms_platform;
  v_creator_has_site boolean := false;
  v_creator_has_profile boolean := false;
  v_auth_method text;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.is_active = true AND COALESCE(NEW.is_active, false) = false) THEN
    UPDATE public.cms_connections
       SET status = 'expired', updated_at = now()
     WHERE managed_by = 'pericles' AND site_url ILIKE '%' || NEW.domain || '%';
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE public.cms_connections
       SET status = 'expired', updated_at = now()
     WHERE managed_by = 'pericles' AND site_url ILIKE '%' || OLD.domain || '%';
    RETURN OLD;
  END IF;
  IF COALESCE(NEW.is_active, false) = false THEN
    RETURN NEW;
  END IF;
  BEGIN
    v_platform := lower(COALESCE(NEW.platform, 'custom_rest'))::public.cms_platform;
  EXCEPTION WHEN OTHERS THEN
    v_platform := 'custom_rest'::public.cms_platform;
  END;
  v_auth_method := CASE
    WHEN NEW.api_key_name IS NOT NULL AND trim(NEW.api_key_name) <> '' THEN 'api_key'
    ELSE 'internal'
  END;
  IF NEW.created_by_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = NEW.created_by_user_id)
      INTO v_creator_has_profile;
    IF v_creator_has_profile THEN
      SELECT EXISTS(
        SELECT 1 FROM public.tracked_sites
         WHERE lower(domain) = lower(NEW.domain)
           AND user_id = NEW.created_by_user_id
      ) INTO v_creator_has_site;
      IF NOT v_creator_has_site THEN
        INSERT INTO public.tracked_sites (user_id, domain, created_at, updated_at)
        VALUES (NEW.created_by_user_id, lower(NEW.domain), now(), now());
      END IF;
    END IF;
  END IF;
  FOR v_site IN
    SELECT ts.id, ts.user_id, ts.domain
      FROM public.tracked_sites ts
      JOIN public.profiles p ON p.user_id = ts.user_id
     WHERE lower(ts.domain) = lower(NEW.domain)
  LOOP
    INSERT INTO public.cms_connections (
      tracked_site_id, user_id, platform, auth_method, status,
      site_url, scopes, capabilities, managed_by, created_at, updated_at
    ) VALUES (
      v_site.id, v_site.user_id, v_platform, v_auth_method, 'active',
      'https://' || v_site.domain,
      ARRAY['posts:read','posts:write']::text[],
      jsonb_build_object(
        'source','pericles_targets',
        'event_type', NEW.event_type,
        'managed_externally', true,
        'auth_scheme', CASE WHEN v_auth_method = 'api_key' THEN 'bearer' ELSE 'edge_secret' END,
        'pericles_target_id', NEW.id,
        'created_by_user_id', NEW.created_by_user_id
      ),
      'pericles', now(), now()
    )
    ON CONFLICT (tracked_site_id, platform) WHERE managed_by = 'pericles'
    DO UPDATE SET
      status = 'active',
      auth_method = EXCLUDED.auth_method,
      capabilities = EXCLUDED.capabilities,
      updated_at = now();
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_pericles_to_cms_connections_iud AFTER INSERT OR DELETE OR UPDATE OF api_key_name, is_active, platform ON public.pericles_targets FOR EACH ROW EXECUTE FUNCTION sync_pericles_target_to_cms_connection();
