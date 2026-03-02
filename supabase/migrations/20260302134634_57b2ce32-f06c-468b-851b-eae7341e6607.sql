
-- Drop the overly permissive service role policy
DROP POLICY "Service role can manage magic links" ON public.magic_links;

-- Add an UPDATE policy for users (needed for marking as used via service role in edge function - service role bypasses RLS anyway)
