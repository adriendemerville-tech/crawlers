
-- Add api_key column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN api_key uuid DEFAULT gen_random_uuid();

-- Backfill existing profiles with unique API keys
UPDATE public.profiles SET api_key = gen_random_uuid() WHERE api_key IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE public.profiles ALTER COLUMN api_key SET NOT NULL;

-- Add unique constraint
ALTER TABLE public.profiles ADD CONSTRAINT profiles_api_key_unique UNIQUE (api_key);
