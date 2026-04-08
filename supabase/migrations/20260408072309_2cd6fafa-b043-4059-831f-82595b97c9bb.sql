
CREATE TABLE public.ai_gateway_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway TEXT NOT NULL DEFAULT 'lovable',
  model TEXT NOT NULL,
  edge_function TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
  is_fallback BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_gateway_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view AI usage"
ON public.ai_gateway_usage
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ai_gateway_usage_created_at ON public.ai_gateway_usage (created_at DESC);
CREATE INDEX idx_ai_gateway_usage_gateway ON public.ai_gateway_usage (gateway, created_at DESC);
