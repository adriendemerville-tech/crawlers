
CREATE TABLE public.hallucination_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  url text NOT NULL,
  user_id uuid NOT NULL,
  original_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  corrected_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  discrepancies jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis_narrative text,
  confusion_sources jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookup by domain
CREATE INDEX idx_hallucination_corrections_domain ON public.hallucination_corrections (domain);

-- RLS
ALTER TABLE public.hallucination_corrections ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read corrections (shared knowledge base)
CREATE POLICY "Authenticated users can view corrections"
  ON public.hallucination_corrections FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own corrections
CREATE POLICY "Users can insert their own corrections"
  ON public.hallucination_corrections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own corrections
CREATE POLICY "Users can update their own corrections"
  ON public.hallucination_corrections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own corrections
CREATE POLICY "Users can delete their own corrections"
  ON public.hallucination_corrections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
