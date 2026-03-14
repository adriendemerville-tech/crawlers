-- Fix search_path on archive_rule_payload function
CREATE OR REPLACE FUNCTION public.archive_rule_payload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.payload_data IS DISTINCT FROM NEW.payload_data THEN
    NEW.previous_payload_data := OLD.payload_data;
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;