REVOKE INSERT, UPDATE, DELETE ON public.startup_trial_applications FROM authenticated;
DROP POLICY IF EXISTS "Users can create their startup trial application" ON public.startup_trial_applications;
REVOKE EXECUTE ON FUNCTION public.submit_startup_trial_application(text, text, date, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_startup_trial_application(text, text, date, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF current_setting('role', true) != 'service_role'
     AND current_setting('app.startup_trial_activation', true) IS DISTINCT FROM 'true' THEN
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