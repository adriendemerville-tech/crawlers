
CREATE TABLE public.url_correction_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_url text NOT NULL,
  corrected_url text,
  decision text NOT NULL CHECK (decision IN ('accepted', 'ignored')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, original_url)
);

ALTER TABLE public.url_correction_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own decisions"
  ON public.url_correction_decisions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own decisions"
  ON public.url_correction_decisions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decisions"
  ON public.url_correction_decisions FOR UPDATE
  USING (auth.uid() = user_id);
