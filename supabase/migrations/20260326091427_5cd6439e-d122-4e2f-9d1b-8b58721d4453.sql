
-- Quiz questions table for SEO/GEO/LLM and Crawlers product quizzes
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('seo_geo_llm', 'crawlers')),
  category TEXT NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_index INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  feature_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick filtering
CREATE INDEX idx_quiz_questions_type_active ON public.quiz_questions(quiz_type, is_active, difficulty);

-- RLS
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read active questions
CREATE POLICY "Anyone can read active quiz questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (is_active = true);

-- Allow admins to manage questions
CREATE POLICY "Admins can manage quiz questions"
  ON public.quiz_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_quiz_questions_updated_at
  BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
