
-- =============================================
-- 1. Fonction pour rétrograder les abonnements expirés
-- =============================================
CREATE OR REPLACE FUNCTION public.downgrade_expired_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Only downgrade profiles where:
  -- - plan is agency_pro
  -- - subscription_status is NOT 'active' via Stripe (i.e. already canceled/expired)
  -- - subscription_expires_at is in the past
  -- - stripe_subscription_id is NULL or subscription_status is not 'active'
  -- This prevents downgrading users with active Stripe subscriptions
  UPDATE profiles
  SET 
    plan_type = 'free',
    subscription_status = 'expired',
    updated_at = now()
  WHERE plan_type = 'agency_pro'
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at < now()
    AND (subscription_status IS NULL OR subscription_status NOT IN ('active'));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Log the cleanup
  IF v_count > 0 THEN
    INSERT INTO analytics_events (event_type, event_data)
    VALUES ('system:subscription_cleanup', jsonb_build_object(
      'downgraded_count', v_count,
      'run_at', now()::text
    ));
  END IF;
  
  RETURN v_count;
END;
$$;

-- =============================================
-- 2. Fonction pour nettoyer le cache audit avec TTL différencié
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_audit_cache_ttl()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Delete expired cache entries (uses the existing expires_at column)
  DELETE FROM audit_cache WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Also cleanup expired domain_data_cache
  DELETE FROM domain_data_cache WHERE expires_at < now();
  
  RETURN v_count;
END;
$$;

-- =============================================
-- 3. Activer les extensions pg_cron et pg_net
-- =============================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
