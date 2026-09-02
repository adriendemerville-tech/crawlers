REVOKE EXECUTE ON FUNCTION public.submit_startup_trial_application(text, text, date, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_startup_trial_application(text, text, date, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_startup_trial_application(
  p_user_id uuid,
  p_siret text,
  p_legal_name text,
  p_creation_date date,
  p_kbis_path text,
  p_verification_details jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(application_id uuid, application_status text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at timestamptz := now() + interval '12 months';
  v_application_id uuid;
BEGIN
  IF current_setting('role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Server activation required';
  END IF;
  IF p_user_id IS NULL OR p_siret !~ '^[0-9]{14}$' THEN
    RAISE EXCEPTION 'Invalid startup trial data';
  END IF;
  IF p_creation_date < (current_date - interval '12 months')::date OR p_creation_date > current_date THEN
    RAISE EXCEPTION 'Company is not eligible for the 12-month offer';
  END IF;
  IF p_kbis_path <> p_user_id::text || '/' || split_part(p_kbis_path, '/', 2) OR split_part(p_kbis_path, '/', 2) = '' THEN
    RAISE EXCEPTION 'Invalid Kbis path';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Unknown user';
  END IF;
  IF EXISTS (SELECT 1 FROM public.startup_trial_applications WHERE user_id = p_user_id OR siret = p_siret) THEN
    RAISE EXCEPTION 'A startup trial has already been claimed';
  END IF;

  INSERT INTO public.startup_trial_applications (
    user_id, siret, legal_name, creation_date, kbis_path,
    status, verification_details, trial_expires_at
  ) VALUES (
    p_user_id, p_siret, left(trim(p_legal_name), 200), p_creation_date,
    p_kbis_path, 'approved', coalesce(p_verification_details, '{}'::jsonb), v_expires_at
  ) RETURNING id INTO v_application_id;

  UPDATE public.profiles
  SET plan_type = 'agency_pro', subscription_status = 'active',
      subscription_expires_at = v_expires_at, billing_period = 'startup_trial', updated_at = now()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_application_id, 'approved'::text, v_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_startup_trial_application(uuid, text, text, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_startup_trial_application(uuid, text, text, date, text, jsonb) TO service_role;