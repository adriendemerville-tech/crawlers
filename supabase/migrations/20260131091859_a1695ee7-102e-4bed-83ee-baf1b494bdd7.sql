-- Add credits_balance to profiles
ALTER TABLE public.profiles 
ADD COLUMN credits_balance integer NOT NULL DEFAULT 0;

-- Create credit_transactions table for audit trail
CREATE TABLE public.credit_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'usage')),
  description text,
  stripe_session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_transactions
CREATE POLICY "Users can view their own transactions"
ON public.credit_transactions
FOR SELECT
USING (auth.uid() = user_id);

-- Create secure RPC function for decrementing credits (server-side only)
CREATE OR REPLACE FUNCTION public.use_credit(p_user_id uuid, p_description text DEFAULT 'Code generation')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
BEGIN
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

  IF v_current_balance < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'balance', v_current_balance);
  END IF;

  -- Decrement balance
  v_new_balance := v_current_balance - 1;
  
  UPDATE profiles
  SET credits_balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, -1, 'usage', p_description);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Create index for performance
CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);