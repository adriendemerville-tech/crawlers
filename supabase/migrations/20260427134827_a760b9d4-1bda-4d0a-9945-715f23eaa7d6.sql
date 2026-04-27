-- Étape 1 : Étendre google_connections pour absorber Google Ads
ALTER TABLE public.google_connections
  ADD COLUMN IF NOT EXISTS ads_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS ads_account_name TEXT,
  ADD COLUMN IF NOT EXISTS ads_status TEXT;

-- Étape 2 : Migrer les données depuis google_ads_connections
-- On rattache les credentials Ads à la connexion principale du même user (par google_email matching ou la plus récente)
DO $$
DECLARE
  ads_row RECORD;
  target_conn_id UUID;
BEGIN
  FOR ads_row IN SELECT * FROM public.google_ads_connections LOOP
    -- Chercher la connexion principale (non-gbp) la plus récente du user
    SELECT id INTO target_conn_id
    FROM public.google_connections
    WHERE user_id = ads_row.user_id
      AND google_email NOT LIKE 'gbp:%'
    ORDER BY updated_at DESC
    LIMIT 1;

    IF target_conn_id IS NOT NULL THEN
      -- Fusionner : ajouter les credentials Ads et étendre les scopes
      UPDATE public.google_connections
      SET ads_customer_id = ads_row.customer_id,
          ads_account_name = ads_row.account_name,
          ads_status = ads_row.status,
          scopes = (
            SELECT array_agg(DISTINCT s)
            FROM unnest(COALESCE(scopes, ARRAY[]::text[]) || ARRAY['https://www.googleapis.com/auth/adwords']) s
          ),
          -- Préserver le refresh_token Ads s'il est différent (Ads a son propre OAuth historiquement)
          refresh_token = COALESCE(refresh_token, ads_row.refresh_token),
          updated_at = NOW()
      WHERE id = target_conn_id;
    ELSE
      -- Pas de connexion principale : créer une nouvelle ligne
      INSERT INTO public.google_connections (
        user_id, google_email, access_token, refresh_token, token_expiry,
        scopes, ads_customer_id, ads_account_name, ads_status
      ) VALUES (
        ads_row.user_id,
        ads_row.account_name,
        ads_row.access_token,
        ads_row.refresh_token,
        ads_row.token_expiry,
        ARRAY['https://www.googleapis.com/auth/adwords'],
        ads_row.customer_id,
        ads_row.account_name,
        ads_row.status
      );
    END IF;
  END LOOP;
END $$;

-- Étape 3 : Fusionner les doublons gbp:* dans la ligne principale du user
DO $$
DECLARE
  gbp_row RECORD;
  main_conn_id UUID;
BEGIN
  FOR gbp_row IN SELECT * FROM public.google_connections WHERE google_email LIKE 'gbp:%' LOOP
    SELECT id INTO main_conn_id
    FROM public.google_connections
    WHERE user_id = gbp_row.user_id
      AND google_email NOT LIKE 'gbp:%'
    ORDER BY updated_at DESC
    LIMIT 1;

    IF main_conn_id IS NOT NULL THEN
      UPDATE public.google_connections
      SET gmb_account_id = COALESCE(gmb_account_id, gbp_row.gmb_account_id),
          gmb_location_id = COALESCE(gmb_location_id, gbp_row.gmb_location_id),
          scopes = (
            SELECT array_agg(DISTINCT s)
            FROM unnest(COALESCE(scopes, ARRAY[]::text[]) || COALESCE(gbp_row.scopes, ARRAY[]::text[])) s
          ),
          updated_at = NOW()
      WHERE id = main_conn_id;

      -- Re-rattacher les tracked_sites pointant vers la ligne gbp
      UPDATE public.tracked_sites
      SET google_connection_id = main_conn_id
      WHERE google_connection_id = gbp_row.id;

      -- Supprimer la ligne gbp
      DELETE FROM public.google_connections WHERE id = gbp_row.id;
    ELSE
      -- Pas de connexion principale : nettoyer le préfixe gbp:
      UPDATE public.google_connections
      SET google_email = REPLACE(google_email, 'gbp:', ''),
          updated_at = NOW()
      WHERE id = gbp_row.id;
    END IF;
  END LOOP;
END $$;

-- Étape 4 : Renommer google_ads_connections en table de backup (au cas où)
ALTER TABLE public.google_ads_connections RENAME TO google_ads_connections_deprecated_20260427;

COMMENT ON TABLE public.google_ads_connections_deprecated_20260427 IS
'DEPRECATED 2026-04-27: data migrated to google_connections.ads_*. Drop after 30 days if no rollback needed.';

COMMENT ON COLUMN public.google_connections.ads_customer_id IS 'Google Ads customer ID (numeric, e.g. 1234567890). Migrated from google_ads_connections.';
COMMENT ON COLUMN public.google_connections.ads_account_name IS 'Google Ads account display name.';
COMMENT ON COLUMN public.google_connections.ads_status IS 'Google Ads connection status: active | pending_setup | revoked.';