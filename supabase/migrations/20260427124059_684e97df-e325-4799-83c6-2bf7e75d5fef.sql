-- Enable RLS on the internal token bucket table.
-- This table is only used server-side via the service_role key (which bypasses RLS).
-- No policies are added on purpose: anon and authenticated roles must NOT read or write it.
ALTER TABLE public.rate_limit_tokens ENABLE ROW LEVEL SECURITY;

-- Defense in depth: explicitly revoke any direct privileges from public API roles.
REVOKE ALL ON TABLE public.rate_limit_tokens FROM anon, authenticated;