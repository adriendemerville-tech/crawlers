-- Add expires_at column to user_roles for temporary roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

-- Create a function to clean up expired roles
CREATE OR REPLACE FUNCTION public.cleanup_expired_roles()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.user_roles WHERE expires_at IS NOT NULL AND expires_at < now();
$$;