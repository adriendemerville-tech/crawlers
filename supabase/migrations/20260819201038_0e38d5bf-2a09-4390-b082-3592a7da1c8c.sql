CREATE OR REPLACE FUNCTION public.use_credit(p_user_id uuid, p_description text DEFAULT 'Code generation'::text, p_amount integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_amount integer;
BEGIN
  v_amount := GREATEST(1, COALESCE(p_amount, 1));

  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Les administrateurs disposent d'un credit illimite : aucun debit, aucune
  -- transaction, mais on renvoie le solde reel pour l'affichage.
  IF public.has_role(p_user_id, 'admin') THEN
    SELECT credits_balance INTO v_current_balance FROM profiles WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'new_balance', COALESCE(v_current_balance, 0), 'unlimited', true);
  END IF;

  SELECT credits_balance INTO v_current_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF v_current_balance < v_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'balance', v_current_balance);
  END IF;

  v_new_balance := v_current_balance - v_amount;

  UPDATE profiles
  SET credits_balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, -v_amount, 'usage', p_description);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$function$;