
-- Enum for source types
CREATE TYPE public.diagnostic_source_type AS ENUM ('crawl', 'audit_tech', 'audit_strategic', 'cocoon');

-- Enum for action assignment
CREATE TYPE public.architect_action_type AS ENUM ('content', 'code', 'both');

-- Enum for workbench item status
CREATE TYPE public.workbench_item_status AS ENUM ('pending', 'assigned', 'in_progress', 'done', 'skipped');

-- Main shared table for both Architects
CREATE TABLE public.architect_workbench (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_type diagnostic_source_type NOT NULL,
  source_function TEXT,
  source_record_id TEXT,
  finding_category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  target_url TEXT,
  action_type architect_action_type,
  payload JSONB DEFAULT '{}'::jsonb,
  status workbench_item_status NOT NULL DEFAULT 'pending',
  assigned_to TEXT,
  consumed_by_content BOOLEAN NOT NULL DEFAULT false,
  consumed_by_code BOOLEAN NOT NULL DEFAULT false,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast queries by each Architect
CREATE INDEX idx_workbench_domain ON public.architect_workbench(domain);
CREATE INDEX idx_workbench_action_type ON public.architect_workbench(action_type, status);
CREATE INDEX idx_workbench_user ON public.architect_workbench(user_id);
CREATE INDEX idx_workbench_source ON public.architect_workbench(source_type, source_record_id);

-- Unique constraint to prevent duplicate imports
CREATE UNIQUE INDEX idx_workbench_source_unique ON public.architect_workbench(source_type, source_record_id) WHERE source_record_id IS NOT NULL;

-- Updated_at trigger
CREATE TRIGGER update_architect_workbench_updated_at
  BEFORE UPDATE ON public.architect_workbench
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.architect_workbench ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workbench items"
  ON public.architect_workbench FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access"
  ON public.architect_workbench FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- FUNCTION: Auto-assign action_type based on finding_category
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.assign_workbench_action_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.action_type IS NULL THEN
    NEW.action_type := CASE
      WHEN NEW.finding_category IN ('content_gap', 'eeat', 'thin_content', 'topical_authority', 'geo_visibility', 'content_freshness', 'missing_content') THEN 'content'::architect_action_type
      WHEN NEW.finding_category IN ('technical_fix', 'speed', 'structured_data', 'meta_tags', 'canonical', 'robots', 'sitemap', 'accessibility', 'core_web_vitals', 'broken_links', 'redirect_chain', 'duplicate_content', 'http_errors', 'security', 'mobile') THEN 'code'::architect_action_type
      WHEN NEW.finding_category IN ('linking', 'cannibalization', 'silo_structure', 'anchor_optimization') THEN 'both'::architect_action_type
      ELSE 'both'::architect_action_type
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_workbench_action
  BEFORE INSERT ON public.architect_workbench
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_workbench_action_type();

-- ══════════════════════════════════════════════════════════════
-- FUNCTION: Populate workbench from existing diagnostic tables
-- Called by edge functions or cron after diagnostics complete
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.populate_architect_workbench(
  p_domain TEXT,
  p_user_id UUID,
  p_tracked_site_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_inserted_audit INTEGER := 0;
  v_inserted_cocoon INTEGER := 0;
  v_inserted_registry INTEGER := 0;
  v_skipped INTEGER := 0;
BEGIN
  -- ── 1. Import from audit_recommendations_registry ──
  INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, target_url, payload)
  SELECT 
    arr.domain,
    p_tracked_site_id,
    arr.user_id,
    CASE 
      WHEN arr.audit_type IN ('technical', 'seo') THEN 'audit_tech'::diagnostic_source_type
      WHEN arr.audit_type IN ('strategic', 'strategic_parallel') THEN 'audit_strategic'::diagnostic_source_type
      ELSE 'audit_tech'::diagnostic_source_type
    END,
    'audit_recommendations_registry',
    arr.id::TEXT,
    arr.category,
    arr.priority,
    arr.title,
    arr.description,
    arr.url,
    jsonb_build_object(
      'fix_type', arr.fix_type,
      'fix_data', arr.fix_data,
      'prompt_summary', arr.prompt_summary,
      'recommendation_id', arr.recommendation_id
    )
  FROM audit_recommendations_registry arr
  WHERE arr.domain = p_domain
    AND arr.user_id = p_user_id
    AND arr.is_resolved = false
  ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;
  
  GET DIAGNOSTICS v_inserted_registry = ROW_COUNT;

  -- ── 2. Import from cocoon_diagnostic_results ──
  INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, payload)
  SELECT
    cdr.domain,
    cdr.tracked_site_id,
    cdr.user_id,
    'cocoon'::diagnostic_source_type,
    cdr.diagnostic_type,
    cdr.id::TEXT,
    COALESCE((f->>'category')::TEXT, 'linking'),
    COALESCE((f->>'severity')::TEXT, 'medium'),
    COALESCE((f->>'title')::TEXT, cdr.diagnostic_type || ' finding'),
    COALESCE((f->>'description')::TEXT, ''),
    jsonb_build_object(
      'scores', cdr.scores,
      'metadata', cdr.metadata,
      'finding_detail', f
    )
  FROM cocoon_diagnostic_results cdr,
    jsonb_array_elements(
      CASE jsonb_typeof(cdr.findings)
        WHEN 'array' THEN cdr.findings
        ELSE '[]'::jsonb
      END
    ) AS f
  WHERE cdr.domain = p_domain
    AND cdr.user_id = p_user_id
    AND cdr.created_at > now() - interval '30 days'
  ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_inserted_cocoon = ROW_COUNT;

  -- ── 3. Import from audit_raw_data (technical audit findings) ──
  INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, target_url, payload)
  SELECT
    ard.domain,
    p_tracked_site_id,
    COALESCE(ard.user_id, p_user_id),
    CASE 
      WHEN ard.audit_type IN ('strategic', 'strategic_parallel') THEN 'audit_strategic'::diagnostic_source_type
      ELSE 'audit_tech'::diagnostic_source_type
    END,
    ard.source_functions[1],
    ard.id::TEXT,
    COALESCE((r->>'category')::TEXT, 'technical_fix'),
    COALESCE((r->>'priority')::TEXT, 'medium'),
    COALESCE((r->>'title')::TEXT, 'Audit finding'),
    COALESCE((r->>'description')::TEXT, ''),
    ard.url,
    jsonb_build_object('raw_recommendation', r, 'audit_type', ard.audit_type)
  FROM audit_raw_data ard,
    jsonb_array_elements(
      CASE 
        WHEN jsonb_typeof(ard.raw_payload->'recommendations') = 'array' THEN ard.raw_payload->'recommendations'
        ELSE '[]'::jsonb
      END
    ) AS r
  WHERE ard.domain = p_domain
    AND (ard.user_id = p_user_id OR ard.user_id IS NULL)
    AND ard.created_at > now() - interval '30 days'
  ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_inserted_audit = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'domain', p_domain,
    'inserted_registry', v_inserted_registry,
    'inserted_cocoon', v_inserted_cocoon,
    'inserted_audit', v_inserted_audit,
    'total_inserted', v_inserted_registry + v_inserted_cocoon + v_inserted_audit
  );
END;
$$;
