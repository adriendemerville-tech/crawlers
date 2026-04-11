-- Table to store raw identity data per source
CREATE TABLE public.site_identity_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('gmb', 'linkedin', 'meta_fb', 'meta_ig', 'crawl')),
  raw_data JSONB NOT NULL DEFAULT '{}',
  mapped_fields JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 99,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tracked_site_id, source_type)
);

-- Priority mapping: lower = higher priority
COMMENT ON TABLE public.site_identity_sources IS 'Stores raw identity data per source with priority hierarchy: gmb(1) > linkedin(2) > meta_fb(3) > meta_ig(4) > crawl(5)';

-- Enable RLS
ALTER TABLE public.site_identity_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own identity sources"
  ON public.site_identity_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own identity sources"
  ON public.site_identity_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own identity sources"
  ON public.site_identity_sources FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own identity sources"
  ON public.site_identity_sources FOR DELETE
  USING (auth.uid() = user_id);

-- Function to resolve identity by priority and update tracked_sites
CREATE OR REPLACE FUNCTION public.resolve_identity_priority(p_tracked_site_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '{}';
  v_source RECORD;
  v_field TEXT;
  v_value JSONB;
  v_used_fields JSONB := '{}';
  -- Fields that can be enriched from social sources
  v_enrichable_fields TEXT[] := ARRAY[
    'brand_name', 'market_sector', 'address', 'business_type',
    'company_size', 'target_audience', 'products_services',
    'founding_year', 'commercial_area', 'entity_type',
    'social_profiles', 'is_local_business', 'primary_language'
  ];
BEGIN
  -- Iterate sources by priority (lowest number = highest priority)
  FOR v_source IN
    SELECT source_type, mapped_fields, priority
    FROM public.site_identity_sources
    WHERE tracked_site_id = p_tracked_site_id
    ORDER BY priority ASC
  LOOP
    -- For each enrichable field, take value from highest priority source that has it
    FOREACH v_field IN ARRAY v_enrichable_fields LOOP
      IF NOT v_used_fields ? v_field THEN
        v_value := v_source.mapped_fields -> v_field;
        IF v_value IS NOT NULL AND v_value::text != 'null' AND v_value::text != '""' THEN
          v_result := v_result || jsonb_build_object(v_field, v_value);
          v_used_fields := v_used_fields || jsonb_build_object(v_field, v_source.source_type);
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Update tracked_sites with resolved fields
  UPDATE public.tracked_sites SET
    brand_name = COALESCE((v_result ->> 'brand_name'), brand_name),
    market_sector = COALESCE((v_result ->> 'market_sector'), market_sector),
    address = COALESCE((v_result ->> 'address'), address),
    business_type = COALESCE((v_result ->> 'business_type'), business_type),
    company_size = COALESCE((v_result ->> 'company_size'), company_size),
    target_audience = COALESCE((v_result ->> 'target_audience'), target_audience),
    products_services = COALESCE((v_result ->> 'products_services'), products_services),
    founding_year = COALESCE((v_result ->> 'founding_year')::integer, founding_year),
    commercial_area = COALESCE((v_result ->> 'commercial_area'), commercial_area),
    entity_type = COALESCE((v_result ->> 'entity_type'), entity_type),
    social_profiles = COALESCE((v_result -> 'social_profiles'), social_profiles),
    is_local_business = COALESCE((v_result ->> 'is_local_business')::boolean, is_local_business),
    primary_language = COALESCE((v_result ->> 'primary_language'), primary_language),
    identity_source = 'multi_source',
    identity_enriched_at = now(),
    identity_confidence = GREATEST(COALESCE(identity_confidence, 0), 
      CASE 
        WHEN v_used_fields ? 'brand_name' AND v_used_fields ? 'market_sector' AND v_used_fields ? 'address' THEN 95
        WHEN v_used_fields ? 'brand_name' AND v_used_fields ? 'market_sector' THEN 85
        WHEN v_used_fields ? 'brand_name' THEN 70
        ELSE 50
      END
    )
  WHERE id = p_tracked_site_id;

  RETURN jsonb_build_object(
    'resolved_fields', v_result,
    'sources_used', v_used_fields,
    'fields_count', jsonb_object_keys_count(v_used_fields)
  );
END;
$$;

-- Helper to count jsonb keys (used in resolve function)
CREATE OR REPLACE FUNCTION public.jsonb_object_keys_count(j JSONB)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT count(*)::integer FROM jsonb_object_keys(j);
$$;

-- Trigger to auto-resolve on insert/update of identity sources
CREATE OR REPLACE FUNCTION public.trigger_resolve_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set priority based on source_type
  NEW.priority := CASE NEW.source_type
    WHEN 'gmb' THEN 1
    WHEN 'linkedin' THEN 2
    WHEN 'meta_fb' THEN 3
    WHEN 'meta_ig' THEN 4
    WHEN 'crawl' THEN 5
    ELSE 99
  END;
  NEW.updated_at := now();
  
  -- Auto-resolve after insert/update
  PERFORM public.resolve_identity_priority(NEW.tracked_site_id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_identity_on_change
  AFTER INSERT OR UPDATE ON public.site_identity_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_resolve_identity();

-- Index for fast lookups
CREATE INDEX idx_site_identity_sources_site ON public.site_identity_sources(tracked_site_id, priority);