
-- Add new finding categories to the trigger for keyword/SERP data
CREATE OR REPLACE FUNCTION public.assign_workbench_action_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.action_type IS NULL THEN
    NEW.action_type := CASE
      -- Content-only categories
      WHEN NEW.finding_category IN ('content_gap', 'eeat', 'thin_content', 'topical_authority', 'geo_visibility', 'content_freshness', 'missing_content', 'missing_page', 'content_upgrade') THEN 'content'::architect_action_type
      -- Code-only categories
      WHEN NEW.finding_category IN ('technical_fix', 'speed', 'structured_data', 'meta_tags', 'canonical', 'robots', 'sitemap', 'accessibility', 'core_web_vitals', 'broken_links', 'redirect_chain', 'duplicate_content', 'http_errors', 'security', 'mobile', 'orphan_pages', 'crawl_errors', 'index_bloat') THEN 'code'::architect_action_type
      -- Both categories (shared data useful to both architects)
      WHEN NEW.finding_category IN ('linking', 'cannibalization', 'silo_structure', 'anchor_optimization', 'keyword_data', 'quick_win', 'serp_analysis', 'missing_terms', 'competitive_gap') THEN 'both'::architect_action_type
      ELSE 'both'::architect_action_type
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Enriched populate function: now also extracts keyword/SERP/quick_wins/content suggestions
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
  v_inserted_registry INTEGER := 0;
  v_inserted_cocoon INTEGER := 0;
  v_inserted_audit INTEGER := 0;
  v_inserted_strategic INTEGER := 0;
  v_skipped INTEGER := 0;
  v_strategic_payload JSONB;
  v_kp JSONB;
  v_pc JSONB;
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

  -- ── 4. Extract keyword/SERP data from strategic audit ──
  SELECT ard.raw_payload INTO v_strategic_payload
  FROM audit_raw_data ard
  WHERE ard.domain = p_domain
    AND ard.audit_type IN ('strategic', 'strategic_parallel')
    AND ard.created_at > now() - interval '30 days'
  ORDER BY ard.created_at DESC
  LIMIT 1;

  IF v_strategic_payload IS NOT NULL THEN
    v_kp := v_strategic_payload->'keyword_positioning';
    v_pc := v_strategic_payload->'priority_content';

    -- 4a. Main keywords (action_type = 'both' — useful to both architects)
    IF v_kp IS NOT NULL AND jsonb_typeof(v_kp->'main_keywords') = 'array' THEN
      INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, action_type, payload)
      SELECT
        p_domain, p_tracked_site_id, p_user_id,
        'audit_strategic'::diagnostic_source_type,
        'audit-strategique-ia',
        'kw_' || p_domain || '_' || (kw->>'keyword'),
        'keyword_data',
        'medium',
        'Mot-clé: ' || (kw->>'keyword'),
        COALESCE(kw->'strategic_analysis'->>'recommended_action', ''),
        'both'::architect_action_type,
        jsonb_build_object(
          'keyword', kw->>'keyword',
          'volume', (kw->>'volume')::int,
          'difficulty', (kw->>'difficulty')::int,
          'current_rank', kw->>'current_rank',
          'business_value', kw->'strategic_analysis'->>'business_value',
          'intent', kw->'strategic_analysis'->>'intent',
          'pain_point', kw->'strategic_analysis'->>'pain_point'
        )
      FROM jsonb_array_elements(v_kp->'main_keywords') AS kw
      WHERE kw->>'keyword' IS NOT NULL
      ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;
      GET DIAGNOSTICS v_inserted_strategic = ROW_COUNT;
    END IF;

    -- 4b. Quick wins (position 11-20, easy improvements)
    IF v_kp IS NOT NULL AND jsonb_typeof(v_kp->'quick_wins') = 'array' THEN
      INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, action_type, payload)
      SELECT
        p_domain, p_tracked_site_id, p_user_id,
        'audit_strategic'::diagnostic_source_type,
        'audit-strategique-ia',
        'qw_' || p_domain || '_' || COALESCE(qw->>'keyword', qw->>'title', 'qw' || row_number() OVER()::text),
        'quick_win',
        'high',
        'Quick Win: ' || COALESCE(qw->>'keyword', qw->>'title', 'Opportunité'),
        COALESCE(qw->>'action', qw->>'recommended_action', ''),
        'both'::architect_action_type,
        qw
      FROM jsonb_array_elements(v_kp->'quick_wins') AS qw
      ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;
      v_inserted_strategic := v_inserted_strategic + (SELECT count(*) FROM jsonb_array_elements(v_kp->'quick_wins'));
    END IF;

    -- 4c. Content gaps (keywords where site has no content)
    IF v_kp IS NOT NULL AND jsonb_typeof(v_kp->'content_gaps') = 'array' THEN
      INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, action_type, payload)
      SELECT
        p_domain, p_tracked_site_id, p_user_id,
        'audit_strategic'::diagnostic_source_type,
        'audit-strategique-ia',
        'cg_' || p_domain || '_' || COALESCE(cg->>'keyword', cg->>'title', 'cg' || row_number() OVER()::text),
        'content_gap',
        COALESCE(cg->>'priority', 'high'),
        'Gap contenu: ' || COALESCE(cg->>'keyword', cg->>'title', 'Gap'),
        COALESCE(cg->>'action', cg->>'rationale', ''),
        'content'::architect_action_type,
        cg
      FROM jsonb_array_elements(v_kp->'content_gaps') AS cg
      ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;
    END IF;

    -- 4d. Missing terms (semantic gaps)
    IF v_kp IS NOT NULL AND jsonb_typeof(v_kp->'missing_terms') = 'array' THEN
      INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, action_type, payload)
      SELECT
        p_domain, p_tracked_site_id, p_user_id,
        'audit_strategic'::diagnostic_source_type,
        'audit-strategique-ia',
        'mt_' || p_domain || '_' || COALESCE(mt->>'term', 'mt' || row_number() OVER()::text),
        'missing_terms',
        CASE WHEN mt->>'importance' = 'critical' THEN 'critical' ELSE 'medium' END,
        'Terme manquant: ' || COALESCE(mt->>'term', 'terme'),
        COALESCE(mt->>'suggested_placement', '') || ' — Utilisé par concurrents: ' || COALESCE(mt->>'competitor_usage', 'inconnu'),
        'both'::architect_action_type,
        mt
      FROM jsonb_array_elements(v_kp->'missing_terms') AS mt
      ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;
    END IF;

    -- 4e. Missing pages (suggested new content)
    IF v_pc IS NOT NULL AND jsonb_typeof(v_pc->'missing_pages') = 'array' THEN
      INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, action_type, payload)
      SELECT
        p_domain, p_tracked_site_id, p_user_id,
        'audit_strategic'::diagnostic_source_type,
        'audit-strategique-ia',
        'mp_' || p_domain || '_' || COALESCE(mp->>'title', 'mp' || row_number() OVER()::text),
        'missing_page',
        CASE WHEN mp->>'expected_impact' = 'high' THEN 'high' ELSE 'medium' END,
        'Page manquante: ' || COALESCE(mp->>'title', 'Page'),
        COALESCE(mp->>'rationale', ''),
        'content'::architect_action_type,
        mp
      FROM jsonb_array_elements(v_pc->'missing_pages') AS mp
      ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;
    END IF;

    -- 4f. Content upgrades (existing pages to improve)
    IF v_pc IS NOT NULL AND jsonb_typeof(v_pc->'content_upgrades') = 'array' THEN
      INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, action_type, payload)
      SELECT
        p_domain, p_tracked_site_id, p_user_id,
        'audit_strategic'::diagnostic_source_type,
        'audit-strategique-ia',
        'cu_' || p_domain || '_' || COALESCE(cu->>'page', 'cu' || row_number() OVER()::text),
        'content_upgrade',
        'high',
        'Amélioration: ' || COALESCE(cu->>'page', 'page'),
        COALESCE(cu->>'current_issue', '') || ' → ' || COALESCE(cu->>'upgrade_strategy', ''),
        'both'::architect_action_type,
        cu
      FROM jsonb_array_elements(v_pc->'content_upgrades') AS cu
      ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;
    END IF;

    -- 4g. Competitive gaps
    IF v_kp IS NOT NULL AND jsonb_typeof(v_kp->'competitive_gaps') = 'array' THEN
      INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, action_type, payload)
      SELECT
        p_domain, p_tracked_site_id, p_user_id,
        'audit_strategic'::diagnostic_source_type,
        'audit-strategique-ia',
        'ccg_' || p_domain || '_' || row_number() OVER()::text,
        'competitive_gap',
        'medium',
        'Écart concurrentiel: ' || COALESCE(gap::text, ''),
        '',
        'both'::architect_action_type,
        jsonb_build_object('gap', gap)
      FROM jsonb_array_elements(v_kp->'competitive_gaps') AS gap
      ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;
    END IF;

    -- 4h. SERP recommendations
    IF v_kp IS NOT NULL AND jsonb_typeof(v_kp->'serp_recommendations') = 'array' THEN
      INSERT INTO architect_workbench (domain, tracked_site_id, user_id, source_type, source_function, source_record_id, finding_category, severity, title, description, action_type, payload)
      SELECT
        p_domain, p_tracked_site_id, p_user_id,
        'audit_strategic'::diagnostic_source_type,
        'audit-strategique-ia',
        'sr_' || p_domain || '_' || row_number() OVER()::text,
        'serp_analysis',
        CASE WHEN sr->>'expected_impact' = 'high' THEN 'high' ELSE 'medium' END,
        'SERP: ' || COALESCE(sr->>'action', 'Recommandation'),
        COALESCE(sr->>'timeframe', ''),
        'both'::architect_action_type,
        sr
      FROM jsonb_array_elements(v_kp->'serp_recommendations') AS sr
      ON CONFLICT (source_type, source_record_id) WHERE source_record_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'domain', p_domain,
    'inserted_registry', v_inserted_registry,
    'inserted_cocoon', v_inserted_cocoon,
    'inserted_audit', v_inserted_audit,
    'inserted_strategic_data', v_inserted_strategic,
    'total_inserted', v_inserted_registry + v_inserted_cocoon + v_inserted_audit + v_inserted_strategic
  );
END;
$$;
