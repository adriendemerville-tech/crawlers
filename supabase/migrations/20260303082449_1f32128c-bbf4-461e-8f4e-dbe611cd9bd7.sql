
-- Add subscription columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text DEFAULT NULL;
