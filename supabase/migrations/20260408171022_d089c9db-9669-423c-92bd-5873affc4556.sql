-- Fix 1: Drop the ambiguous text overload of score_workbench_priority that conflicts with the UUID version
DROP FUNCTION IF EXISTS public.score_workbench_priority(text, text, integer, text, boolean);

-- Fix 2: Set force_content_cycle = true for all active autopilot configs (v3 default)
UPDATE public.autopilot_configs SET force_content_cycle = true WHERE is_active = true AND (force_content_cycle = false OR force_content_cycle IS NULL);