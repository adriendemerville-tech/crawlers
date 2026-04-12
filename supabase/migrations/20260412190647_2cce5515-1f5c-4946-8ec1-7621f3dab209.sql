
-- Function: word-level Jaccard similarity (plpgsql for reliability)
CREATE OR REPLACE FUNCTION public.title_similarity(a text, b text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  words_a text[];
  words_b text[];
  intersection_count int := 0;
  union_count int;
  w text;
BEGIN
  -- Extract words > 2 chars
  SELECT array_agg(DISTINCT x) INTO words_a
  FROM unnest(string_to_array(lower(regexp_replace(COALESCE(a,''), '[^a-zà-ÿ0-9 ]', ' ', 'gi')), ' ')) AS x
  WHERE length(x) > 2;

  SELECT array_agg(DISTINCT x) INTO words_b
  FROM unnest(string_to_array(lower(regexp_replace(COALESCE(b,''), '[^a-zà-ÿ0-9 ]', ' ', 'gi')), ' ')) AS x
  WHERE length(x) > 2;

  IF words_a IS NULL OR words_b IS NULL THEN RETURN 0; END IF;

  -- Count intersection
  FOREACH w IN ARRAY words_a LOOP
    IF w = ANY(words_b) THEN intersection_count := intersection_count + 1; END IF;
  END LOOP;

  -- Union = |A| + |B| - |A∩B|
  union_count := array_length(words_a, 1) + array_length(words_b, 1) - intersection_count;
  IF union_count = 0 THEN RETURN 0; END IF;

  RETURN ROUND(intersection_count::numeric / union_count::numeric, 2);
END;
$$;

-- Trigger: prevent semantic duplicates in architect_workbench
CREATE OR REPLACE FUNCTION public.prevent_workbench_semantic_duplicates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_sim numeric;
BEGIN
  -- Only check for content-related categories
  IF NEW.finding_category NOT IN ('content_gap', 'missing_page', 'content_upgrade', 'keyword_data', 'quick_win', 'topical_authority', 'missing_content', 'geo_visibility', 'competitive_gap') THEN
    RETURN NEW;
  END IF;

  -- Find most similar existing active item
  SELECT id, public.title_similarity(title, NEW.title) INTO v_existing_id, v_sim
  FROM architect_workbench
  WHERE domain = NEW.domain
    AND user_id = NEW.user_id
    AND status IN ('pending', 'assigned', 'in_progress')
    AND finding_category IN ('content_gap', 'missing_page', 'content_upgrade', 'keyword_data', 'quick_win', 'topical_authority', 'missing_content', 'geo_visibility', 'competitive_gap')
  ORDER BY public.title_similarity(title, NEW.title) DESC
  LIMIT 1;

  -- Block if > 60% similar
  IF v_sim IS NOT NULL AND v_sim > 0.6 THEN
    RAISE NOTICE '[workbench-dedup] Blocked: "%" ~= existing % (sim=%)', NEW.title, v_existing_id, v_sim;
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS prevent_semantic_duplicates ON architect_workbench;
CREATE TRIGGER prevent_semantic_duplicates
  BEFORE INSERT ON architect_workbench
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_workbench_semantic_duplicates();
