delete from public.domain_data_cache
where data_type = 'llm_visibility'
  and coalesce(jsonb_array_length(nullif(result_data->'benchmarks','null'::jsonb)), 0) < 3;

delete from public.domain_data_cache
where data_type = 'marina_site_scope';