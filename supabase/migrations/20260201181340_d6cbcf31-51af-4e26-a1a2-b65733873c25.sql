-- Fix the permissive RLS policy for analytics_events
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.analytics_events;

-- Create a more secure policy that still allows tracking
CREATE POLICY "Authenticated users can insert analytics"
ON public.analytics_events FOR INSERT
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);