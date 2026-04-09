
CREATE TABLE public.ux_context_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  page_intent TEXT DEFAULT 'unknown',
  global_score INTEGER DEFAULT 0,
  axis_scores JSONB DEFAULT '{}',
  suggestions JSONB DEFAULT '[]',
  business_context JSONB DEFAULT '{}',
  model_used TEXT DEFAULT 'google/gemini-3-flash-preview',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ux_context_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ux analyses"
ON public.ux_context_analyses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ux analyses"
ON public.ux_context_analyses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ux analyses"
ON public.ux_context_analyses FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_ux_context_analyses_site ON public.ux_context_analyses(tracked_site_id);
CREATE INDEX idx_ux_context_analyses_user ON public.ux_context_analyses(user_id);
