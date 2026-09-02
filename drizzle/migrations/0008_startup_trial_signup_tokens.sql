CREATE TABLE public.startup_trial_signup_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  siret text NOT NULL CHECK (siret ~ '^[0-9]{14}$'),
  legal_name text NOT NULL,
  creation_date date NOT NULL,
  kbis_path text NOT NULL,
  verification_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired')),
  expires_at timestamptz NOT NULL,
  claimed_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.startup_trial_signup_tokens TO service_role;

ALTER TABLE public.startup_trial_signup_tokens ENABLE ROW LEVEL SECURITY;