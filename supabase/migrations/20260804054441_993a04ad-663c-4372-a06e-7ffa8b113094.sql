REVOKE ALL ON FUNCTION public.match_workbench_cluster(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.match_workbench_cluster(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.tg_assign_workbench_cluster() FROM anon, authenticated, public;