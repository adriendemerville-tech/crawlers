-- ═══════════════════════════════════════════════════════════════
-- CRITICAL FIX 1: audits table - Remove "OR (user_id IS NULL)" 
-- Exposes Stripe session IDs and allows anonymous updates
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view their own audits" ON public.audits;
DROP POLICY IF EXISTS "Users can update their own audits" ON public.audits;
DROP POLICY IF EXISTS "Users can create audits" ON public.audits;

CREATE POLICY "Users can view their own audits"
  ON public.audits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own audits"
  ON public.audits FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create audits"
  ON public.audits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- CRITICAL FIX 2: profiles - Protect sensitive columns via trigger
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    NEW.credits_balance := OLD.credits_balance;
    NEW.plan_type := OLD.plan_type;
    NEW.subscription_status := OLD.subscription_status;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.referral_code := OLD.referral_code;
    NEW.referred_by := OLD.referred_by;
    NEW.api_key := OLD.api_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- ═══════════════════════════════════════════════════════════════
-- CRITICAL FIX 3: hallucination_corrections - Owner-only SELECT
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can view corrections" ON public.hallucination_corrections;

CREATE POLICY "Users can view their own corrections"
  ON public.hallucination_corrections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- CRITICAL FIX 4: agency_invitations - Owner-only SELECT
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can view invitations by token" ON public.agency_invitations;

CREATE POLICY "Users can view their own invitations"
  ON public.agency_invitations FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

-- ═══════════════════════════════════════════════════════════════
-- CRITICAL FIX 5: referral_rewards - No public INSERT
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Service can insert referral rewards" ON public.referral_rewards;

-- ═══════════════════════════════════════════════════════════════
-- WARNING FIXES
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Service can manage audit cache" ON public.audit_cache;
DROP POLICY IF EXISTS "Service can manage analyzed urls" ON public.analyzed_urls;
DROP POLICY IF EXISTS "Service can insert clicks" ON public.shared_link_clicks;
DROP POLICY IF EXISTS "Service can insert scan results" ON public.scan_results;

-- ═══════════════════════════════════════════════════════════════
-- billing_info - Protect stripe_customer_id
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF current_setting('role', true) != 'service_role' THEN
    NEW.stripe_customer_id := OLD.stripe_customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_billing_fields_trigger ON public.billing_info;
CREATE TRIGGER protect_billing_fields_trigger
  BEFORE UPDATE ON public.billing_info
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_billing_fields();