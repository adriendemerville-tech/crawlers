
-- Trigger function: give 25 free credits to the first 1000 users
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

  IF total_profiles <= 1000 THEN
    NEW.credits_balance := 25;

    -- Record the welcome bonus transaction
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
    VALUES (NEW.user_id, 25, 'bonus', 'Bienvenue — 25 crédits offerts (1000 premiers inscrits)');
  END IF;

  RETURN NEW;
END;
$function$;

-- Attach trigger BEFORE INSERT on profiles
CREATE TRIGGER trg_welcome_credits
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_welcome_credits();
