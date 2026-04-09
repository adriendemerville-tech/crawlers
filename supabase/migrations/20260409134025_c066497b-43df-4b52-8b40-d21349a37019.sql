
-- Add ux_context to diagnostic_source_type enum
ALTER TYPE public.diagnostic_source_type ADD VALUE IF NOT EXISTS 'ux_context';

-- Update the assign_workbench_action_type trigger to handle ux_optimization
CREATE OR REPLACE FUNCTION public.assign_workbench_action_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.action_type IS NULL THEN
    NEW.action_type := CASE
      WHEN NEW.finding_category IN ('content_gap', 'eeat', 'thin_content', 'topical_authority', 'geo_visibility', 'content_freshness', 'missing_content', 'missing_page', 'content_upgrade') THEN 'content'::architect_action_type
      WHEN NEW.finding_category IN ('technical_fix', 'speed', 'structured_data', 'meta_tags', 'canonical', 'robots', 'sitemap', 'accessibility', 'core_web_vitals', 'broken_links', 'redirect_chain', 'duplicate_content', 'http_errors', 'security', 'mobile', 'orphan_pages', 'crawl_errors', 'index_bloat') THEN 'code'::architect_action_type
      WHEN NEW.finding_category IN ('linking', 'cannibalization', 'silo_structure', 'anchor_optimization', 'keyword_data', 'quick_win', 'serp_analysis', 'missing_terms', 'competitive_gap', 'ux_optimization') THEN 'both'::architect_action_type
      ELSE 'both'::architect_action_type
    END;
  END IF;
  RETURN NEW;
END;
$function$;
