-- Table audits pour stocker les métadonnées de prix et de correctifs
CREATE TABLE public.audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  
  -- Prix dynamique
  dynamic_price DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  sector TEXT DEFAULT 'default',
  
  -- Correctifs
  fixes_count INTEGER NOT NULL DEFAULT 0,
  fixes_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Données d'audit brutes (pour référence)
  audit_data JSONB,
  
  -- Statut de paiement
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Code généré (stocké après paiement)
  generated_code TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own audits"
ON public.audits
FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create audits"
ON public.audits
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own audits"
ON public.audits
FOR UPDATE
USING (auth.uid() = user_id OR user_id IS NULL);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access"
ON public.audits
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_audits_updated_at
BEFORE UPDATE ON public.audits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_audits_user_id ON public.audits(user_id);
CREATE INDEX idx_audits_url ON public.audits(url);
CREATE INDEX idx_audits_payment_status ON public.audits(payment_status);