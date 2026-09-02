CREATE TABLE public.startup_trial_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  siret text NOT NULL CHECK (siret ~ '^[0-9]{14}$'),
  legal_name text NOT NULL,
  creation_date date NOT NULL,
  kbis_path text NOT NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'rejected', 'review')),
  verification_source text NOT NULL DEFAULT 'recherche-entreprises.api.gouv.fr',
  verification_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (siret)
);

GRANT SELECT, INSERT ON public.startup_trial_applications TO authenticated;
GRANT ALL ON public.startup_trial_applications TO service_role;

ALTER TABLE public.startup_trial_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their startup trial application"
  ON public.startup_trial_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their startup trial application"
  ON public.startup_trial_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage startup trial applications"
  ON public.startup_trial_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.submit_startup_trial_application(
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
  v_user_id uuid := auth.uid();
  v_expires_at timestamptz := now() + interval '12 months';
  v_application_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_siret !~ '^[0-9]{14}$' THEN
    RAISE EXCEPTION 'Invalid SIRET';
  END IF;
  IF p_creation_date < (current_date - interval '12 months')::date OR p_creation_date > current_date THEN
    RAISE EXCEPTION 'Company is not eligible for the 12-month offer';
  END IF;
  IF p_kbis_path <> v_user_id::text || '/' || split_part(p_kbis_path, '/', 2) OR split_part(p_kbis_path, '/', 2) = '' THEN
    RAISE EXCEPTION 'Invalid Kbis path';
  END IF;
  IF EXISTS (SELECT 1 FROM public.startup_trial_applications WHERE user_id = v_user_id OR siret = p_siret) THEN
    RAISE EXCEPTION 'A startup trial has already been claimed';
  END IF;

  INSERT INTO public.startup_trial_applications (
    user_id, siret, legal_name, creation_date, kbis_path,
    status, verification_details, trial_expires_at
  ) VALUES (
    v_user_id, p_siret, left(trim(p_legal_name), 200), p_creation_date, p_kbis_path,
    'approved', coalesce(p_verification_details, '{}'::jsonb), v_expires_at
  ) RETURNING id INTO v_application_id;

  PERFORM set_config('app.startup_trial_activation', 'true', true);
  UPDATE public.profiles
  SET plan_type = 'agency_pro',
      subscription_status = 'active',
      subscription_expires_at = v_expires_at,
      billing_period = 'startup_trial',
      updated_at = now()
  WHERE user_id = v_user_id;

  RETURN QUERY SELECT v_application_id, 'approved'::text, v_expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_startup_trial_application(text, text, date, text, jsonb) TO authenticated;

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

DROP POLICY IF EXISTS "Users can upload their startup trial Kbis" ON storage.objects;
CREATE POLICY "Users can upload their startup trial Kbis"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'startup-trial-kbis'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read their startup trial Kbis" ON storage.objects;
CREATE POLICY "Users can read their startup trial Kbis"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'startup-trial-kbis'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their startup trial Kbis" ON storage.objects;
CREATE POLICY "Users can delete their startup trial Kbis"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'startup-trial-kbis'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );