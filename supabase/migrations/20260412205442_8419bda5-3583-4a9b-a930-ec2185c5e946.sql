
ALTER TABLE public.parmenion_decision_log
  ADD COLUMN IF NOT EXISTS reward_signal numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS spiral_score_at_decision numeric DEFAULT NULL;

COMMENT ON COLUMN public.parmenion_decision_log.reward_signal IS 'Formal reward signal (-100 to +100) computed at T+30 by comparing baseline vs outcome. Positive = action was beneficial, negative = action was harmful or neutral despite high spiral_score.';
COMMENT ON COLUMN public.parmenion_decision_log.spiral_score_at_decision IS 'The spiral_score of the top item when this decision was made. Enables correlation analysis between predicted priority and actual measured outcome.';
