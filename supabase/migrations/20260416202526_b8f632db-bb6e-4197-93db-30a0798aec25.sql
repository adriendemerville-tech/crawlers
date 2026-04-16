-- Force security_invoker on the view to respect RLS of querying user
ALTER VIEW public.editorial_pipeline_status SET (security_invoker = true);