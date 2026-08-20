CREATE OR REPLACE FUNCTION public.grant_welcome_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_profiles integer;
BEGIN
  SELECT count(*) INTO total_profiles FROM profiles;

  -- First 1000 users: 50 welcome credits only (no free Pro Agency)
  IF total_profiles <= 1000 THEN
    NEW.credits_balance := 50;

    INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
    VALUES (NEW.user_id, 50, 'bonus', 'Bienvenue — 50 crédits offerts (1000 premiers inscrits)');
  END IF;

  RETURN NEW;
END;
$function$;