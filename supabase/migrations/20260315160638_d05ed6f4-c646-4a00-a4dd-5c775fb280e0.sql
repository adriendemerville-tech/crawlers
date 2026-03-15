
CREATE TABLE public.function_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL,
  requester_email text NOT NULL,
  function_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

ALTER TABLE public.function_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all requests" ON public.function_access_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own requests" ON public.function_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_user_id);

CREATE POLICY "Users can view their own requests" ON public.function_access_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.function_consultation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  function_name text NOT NULL,
  consulted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.function_consultation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage consultation logs" ON public.function_consultation_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert own logs" ON public.function_consultation_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
