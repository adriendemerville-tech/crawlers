CREATE TABLE public.false_positive_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  source text NOT NULL DEFAULT 'user',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain, user_id)
);

ALTER TABLE public.false_positive_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own false positives"
  ON public.false_positive_domains FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own false positives"
  ON public.false_positive_domains FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own false positives"
  ON public.false_positive_domains FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
  ON public.false_positive_domains FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);