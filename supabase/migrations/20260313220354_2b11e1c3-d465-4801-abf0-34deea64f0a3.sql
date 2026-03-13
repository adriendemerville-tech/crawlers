
CREATE TABLE public.async_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_data jsonb,
  error_message text,
  progress integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE public.async_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
  ON public.async_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all jobs"
  ON public.async_jobs FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Users can insert their own jobs"
  ON public.async_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_async_jobs_user_status ON public.async_jobs (user_id, status);
CREATE INDEX idx_async_jobs_function_pending ON public.async_jobs (function_name, status) WHERE status = 'pending';
