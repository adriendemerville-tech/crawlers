-- Create a dedicated history table for rule versions
CREATE TABLE public.site_script_rules_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.site_script_rules(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL,
  user_id uuid NOT NULL,
  url_pattern text NOT NULL,
  payload_type text NOT NULL,
  payload_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_script_rules_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own history
CREATE POLICY "Users can view their own rule history"
  ON public.site_script_rules_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can manage all
CREATE POLICY "Service role can manage rule history"
  ON public.site_script_rules_history
  FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- Index for fast lookups
CREATE INDEX idx_rule_history_user_domain ON public.site_script_rules_history(user_id, domain_id);
CREATE INDEX idx_rule_history_rule_id ON public.site_script_rules_history(rule_id);

-- Update the trigger to also insert into history
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
    
    -- Insert into history table
    INSERT INTO public.site_script_rules_history (rule_id, domain_id, user_id, url_pattern, payload_type, payload_data, version)
    VALUES (OLD.id, OLD.domain_id, OLD.user_id, OLD.url_pattern, OLD.payload_type, OLD.payload_data, OLD.version);
  END IF;
  RETURN NEW;
END;
$$;

-- Also capture the initial version on INSERT
CREATE OR REPLACE FUNCTION public.capture_rule_initial_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.site_script_rules_history (rule_id, domain_id, user_id, url_pattern, payload_type, payload_data, version)
  VALUES (NEW.id, NEW.domain_id, NEW.user_id, NEW.url_pattern, NEW.payload_type, NEW.payload_data, NEW.version);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_rule_initial ON public.site_script_rules;
CREATE TRIGGER trg_capture_rule_initial
  AFTER INSERT ON public.site_script_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_rule_initial_version();