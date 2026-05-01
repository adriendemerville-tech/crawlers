
CREATE OR REPLACE FUNCTION public.auto_create_autopilot_config_for_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tracked_site RECORD;
BEGIN
  -- Only act on active targets with autopilot enabled
  IF NEW.is_active IS NOT TRUE OR NEW.autopilot_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Find the most recent matching tracked_site for this domain
  SELECT id, user_id INTO v_tracked_site
  FROM public.tracked_sites
  WHERE domain = NEW.domain
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_tracked_site.id IS NULL THEN
    RETURN NEW; -- no tracked_site yet, nothing to wire
  END IF;

  -- Skip if a config already exists for that tracked_site
  IF EXISTS (
    SELECT 1 FROM public.autopilot_configs
    WHERE tracked_site_id = v_tracked_site.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.autopilot_configs (
    user_id, tracked_site_id, is_active, status,
    diag_audit_complet, diag_crawl, diag_stratege_cocoon,
    presc_stratege_cocoon, presc_architect, presc_content_architect,
    implementation_mode, max_pages_per_cycle, cooldown_hours,
    content_budget_pct, use_editorial_pipeline
  ) VALUES (
    v_tracked_site.user_id, v_tracked_site.id, true, 'idle',
    true, true, true,
    true, true, true,
    'dry_run', 10, 48,
    30, true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_autopilot_config ON public.parmenion_targets;
CREATE TRIGGER trg_auto_create_autopilot_config
AFTER INSERT OR UPDATE OF is_active, autopilot_enabled, domain
ON public.parmenion_targets
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_autopilot_config_for_target();
