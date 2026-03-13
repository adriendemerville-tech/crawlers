
-- Add context column to store enrichment data (deployment status, impact scores, SERP data)
ALTER TABLE public.actual_results
  ADD COLUMN context_data jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.actual_results.context_data IS 
  'Enriched context: deployment_status, impact_score, serp_keywords, corrective_code_deployed, etc.';
