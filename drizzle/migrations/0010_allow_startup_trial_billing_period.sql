ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_billing_period_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_billing_period_check
  CHECK (billing_period = ANY (ARRAY['monthly'::text, 'annual'::text, 'startup_trial'::text]));