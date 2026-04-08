
ALTER TABLE public.ias_history
  ADD COLUMN IF NOT EXISTS organic_traction_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brand_maturity_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brand_penetration_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momentum_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diagnostic_text text,
  ADD COLUMN IF NOT EXISTS sub_scores_detail jsonb DEFAULT '{}'::jsonb;
