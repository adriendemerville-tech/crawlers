-- Table pour tracker les paiements Stripe et débloquer les codes générés
CREATE TABLE public.stripe_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  user_id UUID,
  email TEXT,
  site_url TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending',
  fixes_count INTEGER DEFAULT 0,
  generated_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stripe_payments ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs de voir leurs propres paiements
CREATE POLICY "Users can view their own payments"
  ON public.stripe_payments
  FOR SELECT
  USING (auth.uid() = user_id OR email = auth.email());

-- Trigger pour updated_at
CREATE TRIGGER update_stripe_payments_updated_at
  BEFORE UPDATE ON public.stripe_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();