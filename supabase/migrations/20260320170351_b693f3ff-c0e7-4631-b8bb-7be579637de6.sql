
-- Table pour stocker les clés API d'outils tiers (GTmetrix, etc.)
CREATE TABLE public.tool_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  api_key text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tool_name)
);

ALTER TABLE public.tool_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tool API keys"
  ON public.tool_api_keys
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_tool_api_keys_updated_at
  BEFORE UPDATE ON public.tool_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
