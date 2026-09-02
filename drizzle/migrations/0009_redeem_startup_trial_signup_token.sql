CREATE OR REPLACE FUNCTION public.redeem_startup_trial_signup_token(
  p_token_hash text,
  p_user_id uuid
)
RETURNS TABLE(application_id uuid, expires_at timestamptz, legal_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token public.startup_trial_signup_tokens;
  v_expires_at timestamptz := now() + interval '12 months';
  v_application_id uuid;
BEGIN
  IF current_setting('role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Server activation required';
  END IF;
  IF p_user_id IS NULL OR p_token_hash IS NULL THEN
    RAISE EXCEPTION 'Invalid redemption data';
  END IF;

  SELECT * INTO v_token
  FROM public.startup_trial_signup_tokens
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF v_token.id IS NULL THEN
    RAISE EXCEPTION 'Unknown startup trial token';
  END IF;
  IF v_token.status <> 'pending' THEN
    RAISE EXCEPTION 'Startup trial token already used';
  END IF;
  IF v_token.expires_at < now() THEN
    UPDATE public.startup_trial_signup_tokens SET status = 'expired' WHERE id = v_token.id;
    RAISE EXCEPTION 'Startup trial token expired';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Unknown user';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.startup_trial_applications
    WHERE user_id = p_user_id OR siret = v_token.siret
  ) THEN
    RAISE EXCEPTION 'A startup trial has already been claimed';
  END IF;

  INSERT INTO public.startup_trial_applications (
    user_id, siret, legal_name, creation_date, kbis_path,
    status, verification_details, trial_expires_at
  ) VALUES (
    p_user_id, v_token.siret, v_token.legal_name, v_token.creation_date, v_token.kbis_path,
    'approved', v_token.verification_details, v_expires_at
  ) RETURNING id INTO v_application_id;

  UPDATE public.startup_trial_signup_tokens
  SET status = 'claimed', claimed_user_id = p_user_id, claimed_at = now()
  WHERE id = v_token.id;

  UPDATE public.profiles
  SET plan_type = 'agency_pro', subscription_status = 'active',
      subscription_expires_at = v_expires_at, billing_period = 'startup_trial', updated_at = now()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_application_id, v_expires_at, v_token.legal_name;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_startup_trial_signup_token(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_startup_trial_signup_token(text, uuid) TO service_role;