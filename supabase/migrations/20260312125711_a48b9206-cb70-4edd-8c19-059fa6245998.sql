
CREATE TABLE public.verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_codes_email_code ON public.verification_codes (email, code);
CREATE INDEX idx_verification_codes_expires ON public.verification_codes (expires_at);

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
