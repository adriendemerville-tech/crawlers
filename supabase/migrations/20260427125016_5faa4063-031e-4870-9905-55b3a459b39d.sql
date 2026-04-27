-- 1. Colonne created_by_user_id
ALTER TABLE public.parmenion_targets
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parmenion_targets_creator
  ON public.parmenion_targets(created_by_user_id);

-- 2. Trigger
CREATE OR REPLACE FUNCTION public.sync_parmenion_target_to_cms_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
     WHERE managed_by = 'parmenion' AND site_url ILIKE '%' || NEW.domain || '%';
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.cms_connections
       SET status = 'expired', updated_at = now()
     WHERE managed_by = 'parmenion' AND site_url ILIKE '%' || OLD.domain || '%';
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

  -- Auto-créer tracked_sites pour le créateur (uniquement si profile valide)
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

  -- cms_connections pour tous les tracked_sites du domaine ayant un profil valide
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
        'source','parmenion_targets',
        'event_type', NEW.event_type,
        'managed_externally', true,
        'auth_scheme', CASE WHEN v_auth_method = 'api_key' THEN 'bearer' ELSE 'edge_secret' END,
        'parmenion_target_id', NEW.id,
        'created_by_user_id', NEW.created_by_user_id
      ),
      'parmenion', now(), now()
    )
    ON CONFLICT (tracked_site_id, platform) WHERE managed_by = 'parmenion'
    DO UPDATE SET
      status = 'active',
      auth_method = EXCLUDED.auth_method,
      capabilities = EXCLUDED.capabilities,
      updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3. Backfill (ignore orphelins)
DO $$
DECLARE
  v_target RECORD;
  v_site RECORD;
  v_platform public.cms_platform;
  v_auth_method text;
BEGIN
  FOR v_target IN SELECT * FROM public.parmenion_targets WHERE is_active = true LOOP
    BEGIN
      v_platform := lower(COALESCE(v_target.platform, 'custom_rest'))::public.cms_platform;
    EXCEPTION WHEN OTHERS THEN
      v_platform := 'custom_rest'::public.cms_platform;
    END;

    v_auth_method := CASE
      WHEN v_target.api_key_name IS NOT NULL AND trim(v_target.api_key_name) <> '' THEN 'api_key'
      ELSE 'internal'
    END;

    FOR v_site IN
      SELECT ts.id, ts.user_id, ts.domain
        FROM public.tracked_sites ts
        JOIN public.profiles p ON p.user_id = ts.user_id
       WHERE lower(ts.domain) = lower(v_target.domain)
    LOOP
      INSERT INTO public.cms_connections (
        tracked_site_id, user_id, platform, auth_method, status,
        site_url, scopes, capabilities, managed_by, created_at, updated_at
      ) VALUES (
        v_site.id, v_site.user_id, v_platform, v_auth_method, 'active',
        'https://' || v_site.domain,
        ARRAY['posts:read','posts:write']::text[],
        jsonb_build_object(
          'source','parmenion_targets_backfill',
          'event_type', v_target.event_type,
          'managed_externally', true,
          'auth_scheme', CASE WHEN v_auth_method = 'api_key' THEN 'bearer' ELSE 'edge_secret' END,
          'parmenion_target_id', v_target.id
        ),
        'parmenion', now(), now()
      )
      ON CONFLICT (tracked_site_id, platform) WHERE managed_by = 'parmenion'
      DO UPDATE SET status = 'active', updated_at = now();
    END LOOP;
  END LOOP;
END $$;