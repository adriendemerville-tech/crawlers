
-- Fix security definer view by making it invoker-based
ALTER VIEW public.revenue_weekly_summary SET (security_invoker = on);
