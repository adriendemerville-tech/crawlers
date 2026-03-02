
CREATE OR REPLACE FUNCTION public.use_credit(p_user_id uuid, p_description text DEFAULT 'Code generation'::text, p_amount integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_amount integer;
BEGIN
  -- Ensure amount is at least 1
  v_amount := GREATEST(1, COALESCE(p_amount, 1));

  -- Check caller is the user
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get current balance with row lock
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

  -- Decrement balance by the requested amount
  v_new_balance := v_current_balance - v_amount;
  
  UPDATE profiles
  SET credits_balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, -v_amount, 'usage', p_description);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
