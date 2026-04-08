
-- 1. Drop legacy use_credit overload (2-arg version)
DROP FUNCTION IF EXISTS public.use_credit(uuid, text);

-- 2. Drop legacy score_workbench_priority overload (3-arg version)
DROP FUNCTION IF EXISTS public.score_workbench_priority(text, uuid, integer);

-- 3. Enable pg_cron and pg_net for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
