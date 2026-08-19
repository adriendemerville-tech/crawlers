ALTER TABLE public.ai_gateway_usage ADD COLUMN IF NOT EXISTS feature text;
CREATE INDEX IF NOT EXISTS ai_gateway_usage_feature_created_idx ON public.ai_gateway_usage (feature, created_at DESC);