CREATE TABLE public.sdk_toggle_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  requested_by uuid NOT NULL,
  requested_value boolean NOT NULL,
  confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour'),
  confirmed_at timestamptz
);

ALTER TABLE public.sdk_toggle_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read own confirmations"
  ON public.sdk_toggle_confirmations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert confirmations"
  ON public.sdk_toggle_confirmations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));