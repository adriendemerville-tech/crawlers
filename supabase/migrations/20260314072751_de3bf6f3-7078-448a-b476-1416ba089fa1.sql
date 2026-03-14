-- Add versioning columns to site_script_rules
ALTER TABLE public.site_script_rules
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_payload_data jsonb DEFAULT NULL;

-- Create a trigger to auto-archive previous payload on update
CREATE OR REPLACE FUNCTION public.archive_rule_payload()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.payload_data IS DISTINCT FROM NEW.payload_data THEN
    NEW.previous_payload_data := OLD.payload_data;
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_rule_payload ON public.site_script_rules;
CREATE TRIGGER trg_archive_rule_payload
  BEFORE UPDATE ON public.site_script_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_rule_payload();