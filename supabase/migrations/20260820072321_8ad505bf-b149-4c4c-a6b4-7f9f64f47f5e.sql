UPDATE audit_cache
SET result_data = result_data - 'strategic'
WHERE cache_key LIKE 'marina_site_scope_%'
  AND result_data ? 'strategic'
  AND (result_data->'strategic'->'citation_breakdown') IS NULL;