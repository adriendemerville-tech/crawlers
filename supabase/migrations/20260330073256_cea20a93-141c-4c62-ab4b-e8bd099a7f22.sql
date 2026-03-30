
CREATE TABLE public.marina_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_marina_api_keys_user ON public.marina_api_keys(user_id);
CREATE INDEX idx_marina_api_keys_key ON public.marina_api_keys(api_key);

ALTER TABLE public.marina_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own marina key"
  ON public.marina_api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
