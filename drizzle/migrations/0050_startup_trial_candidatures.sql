CREATE TABLE public.startup_trial_candidatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  siret text NOT NULL CHECK (siret ~ '^\d{14}$'),
  kbis_path text NOT NULL,
  activity text NOT NULL,
  creation_date date NOT NULL,
  email text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_at timestamptz,
  decided_by uuid,
  rejection_reason text,
  activated_user_id uuid,
  signup_token_id uuid,
  verification_details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX startup_trial_candidatures_siret_open_idx
  ON public.startup_trial_candidatures (siret) WHERE status IN ('pending','approved');
CREATE INDEX startup_trial_candidatures_status_idx ON public.startup_trial_candidatures (status, submitted_at DESC);
CREATE INDEX startup_trial_candidatures_token_idx ON public.startup_trial_candidatures (signup_token_id);

GRANT SELECT, UPDATE ON public.startup_trial_candidatures TO authenticated;
GRANT ALL ON public.startup_trial_candidatures TO service_role;

ALTER TABLE public.startup_trial_candidatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read startup candidatures"
  ON public.startup_trial_candidatures FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update startup candidatures"
  ON public.startup_trial_candidatures FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));