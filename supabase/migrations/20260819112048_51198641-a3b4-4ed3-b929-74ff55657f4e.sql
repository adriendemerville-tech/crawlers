CREATE TABLE public.marina_paid_passes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pass_token text NOT NULL UNIQUE,
  email text,
  txn_id text UNIQUE,
  amount_cents integer,
  status text NOT NULL DEFAULT 'granted',
  job_id uuid,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_marina_paid_passes_token ON public.marina_paid_passes(pass_token);
GRANT ALL ON public.marina_paid_passes TO service_role;
ALTER TABLE public.marina_paid_passes ENABLE ROW LEVEL SECURITY;