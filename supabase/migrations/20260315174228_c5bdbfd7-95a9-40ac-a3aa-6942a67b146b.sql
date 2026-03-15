CREATE OR REPLACE FUNCTION public.get_database_size()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_bytes', pg_database_size(current_database()),
    'total_mb', round(pg_database_size(current_database()) / 1048576.0, 2),
    'total_gb', round(pg_database_size(current_database()) / 1073741824.0, 3)
  );
$$;