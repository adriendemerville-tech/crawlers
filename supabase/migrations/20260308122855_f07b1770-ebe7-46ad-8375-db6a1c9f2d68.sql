
-- Add subscription expiry field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone DEFAULT NULL;

-- Update grant_welcome_credits to also grant Pro Agency for first 100 users
CREATE OR REPLACE FUNCTION public.grant_welcome_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_profiles integer;
BEGIN
  -- Count existing profiles (before this insert)
  SELECT count(*) INTO total_profiles FROM profiles;

  -- First 100 users: free Pro Agency for 6 months + 25 credits
  IF total_profiles <= 100 THEN
    NEW.plan_type := 'agency_pro';
    NEW.subscription_status := 'active';
    NEW.subscription_expires_at := now() + interval '6 months';
    NEW.credits_balance := 25;

    INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
    VALUES (NEW.user_id, 25, 'bonus', 'Bienvenue — 25 crédits offerts + Pro Agency 6 mois (100 premiers inscrits)');

  -- First 1000 users: 25 welcome credits
  ELSIF total_profiles <= 1000 THEN
    NEW.credits_balance := 25;

    INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
    VALUES (NEW.user_id, 25, 'bonus', 'Bienvenue — 25 crédits offerts (1000 premiers inscrits)');
  END IF;

  RETURN NEW;
END;
$function$;
