-- Table de logs MCP
CREATE TABLE public.mcp_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  tool_name text NOT NULL,
  input_params jsonb,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  execution_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_usage_logs_user_id ON public.mcp_usage_logs(user_id);
CREATE INDEX idx_mcp_usage_logs_created_at ON public.mcp_usage_logs(created_at DESC);
CREATE INDEX idx_mcp_usage_logs_tool ON public.mcp_usage_logs(tool_name);

ALTER TABLE public.mcp_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on mcp_usage_logs"
  ON public.mcp_usage_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can read mcp_usage_logs"
  ON public.mcp_usage_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own mcp_usage_logs"
  ON public.mcp_usage_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);