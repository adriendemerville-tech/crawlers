-- Table des recommandations intelligentes conditionnelles
CREATE TABLE public.smart_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  recommendation_key TEXT NOT NULL,
  is_unlocked BOOLEAN NOT NULL DEFAULT false,
  unlock_criteria_met JSONB DEFAULT '{}'::jsonb,
  unlock_criteria_required JSONB DEFAULT '{}'::jsonb,
  maturity_level TEXT NOT NULL DEFAULT 'beginner',
  last_evaluated_at TIMESTAMPTZ,
  recommendation_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'locked',
  category TEXT NOT NULL DEFAULT 'seo',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tracked_site_id, recommendation_key)
);

-- Enable RLS
ALTER TABLE public.smart_recommendations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own recommendations"
ON public.smart_recommendations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations"
ON public.smart_recommendations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recommendations"
ON public.smart_recommendations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recommendations"
ON public.smart_recommendations FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_smart_recommendations_updated_at
BEFORE UPDATE ON public.smart_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_smart_recommendations_site ON public.smart_recommendations(tracked_site_id);
CREATE INDEX idx_smart_recommendations_user ON public.smart_recommendations(user_id);
CREATE INDEX idx_smart_recommendations_status ON public.smart_recommendations(status) WHERE status != 'dismissed';