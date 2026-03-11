
-- Table market_trends
CREATE TABLE public.market_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  market_region text NOT NULL UNIQUE,
  intent_rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  llm_shares jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- RLS: public read, service_role write
ALTER TABLE public.market_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market_trends"
  ON public.market_trends FOR SELECT
  TO anon, authenticated
  USING (true);

-- Insert default FR row
INSERT INTO public.market_trends (market_region, intent_rates, llm_shares)
VALUES (
  'FR',
  '{"informational": 0.25, "commercial": 0.12, "local": 0.03, "default": 0.05}'::jsonb,
  '{"ChatGPT": 0.25, "Perplexity": 0.06, "Gemini": 0.12, "Google_AI": 0.55, "Grok": 0.02}'::jsonb
);
