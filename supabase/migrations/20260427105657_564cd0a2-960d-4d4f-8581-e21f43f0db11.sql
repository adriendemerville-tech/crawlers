ALTER TABLE public.cms_connections
  ADD COLUMN IF NOT EXISTS managed_by TEXT DEFAULT 'user';

COMMENT ON COLUMN public.cms_connections.managed_by IS
  'Origine : ''user'' (UI) ou ''parmenion'' (miroir auto depuis parmenion_targets)';

CREATE UNIQUE INDEX IF NOT EXISTS cms_connections_parmenion_mirror_uniq
  ON public.cms_connections (tracked_site_id, platform)
  WHERE managed_by = 'parmenion';

CREATE OR REPLACE FUNCTION public.sync_parmenion_target_to_cms_connection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site RECORD;
  v_platform public.cms_platform;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.is_active = true AND COALESCE(NEW.is_active, false) = false) THEN
    UPDATE public.cms_connections
       SET status = 'expired', updated_at = now()
     WHERE managed_by = 'parmenion' AND site_url ILIKE '%' || NEW.domain || '%';
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.cms_connections
       SET status = 'expired', updated_at = now()
     WHERE managed_by = 'parmenion' AND site_url ILIKE '%' || OLD.domain || '%';
    RETURN OLD;
  END IF;

  IF COALESCE(NEW.is_active, false) = false THEN RETURN NEW; END IF;
  IF NEW.api_key_name IS NULL OR trim(NEW.api_key_name) = '' THEN RETURN NEW; END IF;

  BEGIN
    v_platform := lower(COALESCE(NEW.platform, 'custom_rest'))::public.cms_platform;
  EXCEPTION WHEN OTHERS THEN
    v_platform := 'custom_rest'::public.cms_platform;
  END;

  FOR v_site IN
    SELECT id, user_id, domain FROM public.tracked_sites
     WHERE lower(domain) = lower(NEW.domain)
  LOOP
    INSERT INTO public.cms_connections (
      tracked_site_id, user_id, platform, auth_method, status,
      site_url, scopes, capabilities, managed_by, created_at, updated_at
    ) VALUES (
      v_site.id, v_site.user_id, v_platform, 'api_key', 'active',
      'https://' || v_site.domain,
      ARRAY['posts:read','posts:write']::text[],
      jsonb_build_object('source','parmenion_targets','event_type',NEW.event_type,'managed_externally',true,'auth_scheme','bearer'),
      'parmenion', now(), now()
    )
    ON CONFLICT (tracked_site_id, platform) WHERE managed_by = 'parmenion'
    DO UPDATE SET status = 'active', auth_method = 'api_key',
                  capabilities = EXCLUDED.capabilities, updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parmenion_to_cms_connections_iud ON public.parmenion_targets;
CREATE TRIGGER trg_parmenion_to_cms_connections_iud
AFTER INSERT OR UPDATE OF api_key_name, is_active, platform OR DELETE
ON public.parmenion_targets
FOR EACH ROW
EXECUTE FUNCTION public.sync_parmenion_target_to_cms_connection();

DO $$
DECLARE
  r RECORD;
  v_site RECORD;
  v_platform public.cms_platform;
BEGIN
  FOR r IN SELECT * FROM public.parmenion_targets
           WHERE is_active = true AND api_key_name IS NOT NULL AND trim(api_key_name) != ''
  LOOP
    BEGIN
      v_platform := lower(COALESCE(r.platform, 'custom_rest'))::public.cms_platform;
    EXCEPTION WHEN OTHERS THEN
      v_platform := 'custom_rest'::public.cms_platform;
    END;

    FOR v_site IN
      SELECT id, user_id, domain FROM public.tracked_sites
       WHERE lower(domain) = lower(r.domain)
    LOOP
      INSERT INTO public.cms_connections (
        tracked_site_id, user_id, platform, auth_method, status,
        site_url, scopes, capabilities, managed_by, created_at, updated_at
      ) VALUES (
        v_site.id, v_site.user_id, v_platform, 'api_key', 'active',
        'https://' || v_site.domain,
        ARRAY['posts:read','posts:write']::text[],
        jsonb_build_object('source','parmenion_targets','event_type',r.event_type,'managed_externally',true,'backfilled',true,'auth_scheme','bearer'),
        'parmenion', now(), now()
      )
      ON CONFLICT (tracked_site_id, platform) WHERE managed_by = 'parmenion'
      DO UPDATE SET status = 'active', updated_at = now();
    END LOOP;
  END LOOP;
END $$;