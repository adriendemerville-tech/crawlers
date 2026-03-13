
-- Affiliate codes table for admin-managed promotional codes
CREATE TABLE public.affiliate_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  assigned_to_user_id uuid,
  discount_percent integer NOT NULL DEFAULT 100,
  duration_months integer NOT NULL DEFAULT 1,
  max_activations integer NOT NULL DEFAULT 1,
  current_activations integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can manage affiliate codes
CREATE POLICY "Admins can manage affiliate_codes"
  ON public.affiliate_codes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Track which affiliate code a user used at signup
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS affiliate_code_used text DEFAULT NULL;
