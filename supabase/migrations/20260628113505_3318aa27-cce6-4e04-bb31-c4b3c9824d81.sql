ALTER TABLE public.ai_gateway_usage
  ADD COLUMN IF NOT EXISTS cache_creation_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_read_tokens integer DEFAULT 0;