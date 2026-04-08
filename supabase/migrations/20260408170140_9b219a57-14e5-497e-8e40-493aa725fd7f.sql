
-- Trigger function: merge duplicate workbench items on insert
CREATE OR REPLACE FUNCTION public.merge_workbench_duplicates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_payload jsonb;
  v_existing_severity text;
  v_merged_sources jsonb;
  v_severity_rank integer;
  v_existing_rank integer;
  v_new_severity text;
BEGIN
  -- Only merge if we have enough targeting info
  IF NEW.target_url IS NULL OR NEW.target_selector IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find an existing non-done item with same fingerprint (different source)
  SELECT id, payload, severity INTO v_existing_id, v_existing_payload, v_existing_severity
  FROM architect_workbench
  WHERE domain = NEW.domain
    AND user_id = NEW.user_id
    AND target_url = NEW.target_url
    AND target_selector = NEW.target_selector
    AND target_operation = NEW.target_operation
    AND status IN ('pending', 'assigned', 'in_progress')
    AND id != NEW.id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    -- No duplicate, proceed with insert
    RETURN NEW;
  END IF;

  -- Compute severity rank (higher = more severe)
  v_severity_rank := CASE NEW.severity
    WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END;
  v_existing_rank := CASE v_existing_severity
    WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END;
  
  v_new_severity := CASE WHEN v_severity_rank > v_existing_rank THEN NEW.severity ELSE v_existing_severity END;

  -- Build merged_sources array in payload
  v_merged_sources := COALESCE(v_existing_payload->'merged_sources', '[]'::jsonb) 
    || jsonb_build_array(jsonb_build_object(
      'source_type', NEW.source_type,
      'source_function', NEW.source_function,
      'title', NEW.title,
      'severity', NEW.severity,
      'merged_at', now()::text
    ));

  -- Update existing item with merged info
  UPDATE architect_workbench SET
    severity = v_new_severity,
    payload = COALESCE(v_existing_payload, '{}'::jsonb) 
      || jsonb_build_object(
        'merged_sources', v_merged_sources,
        'convergence_count', jsonb_array_length(v_merged_sources) + 1
      ),
    updated_at = now()
  WHERE id = v_existing_id;

  -- Skip inserting the duplicate row
  RETURN NULL;
END;
$$;

-- Attach as BEFORE INSERT trigger
CREATE TRIGGER trg_merge_workbench_duplicates
BEFORE INSERT ON public.architect_workbench
FOR EACH ROW
EXECUTE FUNCTION public.merge_workbench_duplicates();
