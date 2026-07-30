ALTER TABLE public.linkedin_features_catalog
  ADD COLUMN IF NOT EXISTS doc_section_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capture_route text,
  ADD COLUMN IF NOT EXISTS capture_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_table text,
  ADD COLUMN IF NOT EXISTS last_evidence_count integer,
  ADD COLUMN IF NOT EXISTS last_evidence_at timestamptz,
  ADD COLUMN IF NOT EXISTS readiness_score integer NOT NULL DEFAULT 0;

ALTER TABLE public.linkedin_scheduled_posts
  ADD COLUMN IF NOT EXISTS doc_sections_used text[] NOT NULL DEFAULT '{}';

-- Compteur de lignes réelles pour une table donnée (garde-fou anti-invention :
-- on ne raconte que des fonctionnalités qui produisent de la donnée).
CREATE OR REPLACE FUNCTION public.count_table_rows(p_table text)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF p_table !~ '^[a-z_][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'invalid table name';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) THEN
    RETURN NULL;
  END IF;
  EXECUTE format('SELECT count(*) FROM public.%I', p_table) INTO v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.count_table_rows(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_table_rows(text) TO service_role;

UPDATE public.linkedin_features_catalog SET
  doc_section_ids = CASE slug
    WHEN 'geo-bot-attribution' THEN ARRAY['indicators','integrations']
    WHEN 'autopilot-parmenion' THEN ARRAY['autopilot','agents']
    WHEN 'strategic-audit' THEN ARRAY['indicators','crawl-engine']
    WHEN 'content-architect' THEN ARRAY['agents','api']
    WHEN 'cocoon-3d' THEN ARRAY['cocoon']
    WHEN 'drop-detector' THEN ARRAY['indicators','integrations']
    WHEN 'copilot-market' THEN ARRAY['agents']
    WHEN 'sea-seo-bridge' THEN ARRAY['integrations','serp-kpis']
    WHEN 'serp-benchmark' THEN ARRAY['serp-kpis']
    WHEN 'breathing-spiral' THEN ARRAY['autopilot']
    WHEN 'ias-strategic-index' THEN ARRAY['indicators']
    WHEN 'shield-cloudflare' THEN ARRAY['integrations']
    WHEN 'eeat-scoring' THEN ARRAY['indicators']
    WHEN 'crawlers-api' THEN ARRAY['api']
    WHEN 'marina-outreach' THEN ARRAY['marina']
    ELSE '{}'::text[]
  END,
  capture_route = COALESCE(capture_route, demo_url),
  evidence_table = CASE slug
    WHEN 'geo-bot-attribution' THEN 'ai_attribution_events'
    WHEN 'autopilot-parmenion' THEN 'parmenion_decision_log'
    WHEN 'strategic-audit' THEN 'audits'
    WHEN 'content-architect' THEN 'content_generation_logs'
    WHEN 'cocoon-3d' THEN 'cocoon_sessions'
    WHEN 'drop-detector' THEN 'drop_diagnostics'
    WHEN 'copilot-market' THEN 'copilot_actions'
    WHEN 'sea-seo-bridge' THEN 'google_ads_history_log'
    WHEN 'serp-benchmark' THEN 'keyword_universe'
    WHEN 'breathing-spiral' THEN 'audit_impact_snapshots'
    WHEN 'ias-strategic-index' THEN 'ias_history'
    WHEN 'shield-cloudflare' THEN 'cf_shield_configs'
    WHEN 'eeat-scoring' THEN 'eeat_scoring_criteria'
    WHEN 'crawlers-api' THEN 'crawlers_api_jobs'
    WHEN 'marina-outreach' THEN 'marina_prospects'
    ELSE NULL
  END;