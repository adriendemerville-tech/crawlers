-- Fix conflicting policies on magic_links: tokens must not be readable by users client-side.
-- Drop the permissive SELECT policy; keep the restrictive "No user SELECT on magic_links" (USING false).
-- Magic link tokens are validated server-side via edge functions only.
DROP POLICY IF EXISTS "Users can view their own magic links" ON public.magic_links;