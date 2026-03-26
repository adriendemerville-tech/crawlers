ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS question_en text,
  ADD COLUMN IF NOT EXISTS question_es text,
  ADD COLUMN IF NOT EXISTS options_en jsonb,
  ADD COLUMN IF NOT EXISTS options_es jsonb,
  ADD COLUMN IF NOT EXISTS explanation_en text,
  ADD COLUMN IF NOT EXISTS explanation_es text;