-- Cross-agent communication insights table
CREATE TABLE public.cross_agent_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  insight_type TEXT NOT NULL DEFAULT 'cross_pattern',
  source_agent TEXT NOT NULL DEFAULT 'felix',
  target_agent TEXT NOT NULL DEFAULT 'stratege',
  insight_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_cross_agent_insights_site ON public.cross_agent_insights(tracked_site_id, is_resolved);
CREATE INDEX idx_cross_agent_insights_user ON public.cross_agent_insights(user_id, insight_type);

-- Enable RLS
ALTER TABLE public.cross_agent_insights ENABLE ROW LEVEL SECURITY;

-- Users can view their own insights
CREATE POLICY "Users can view own cross agent insights"
ON public.cross_agent_insights FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Service role can insert/update (edge functions)
CREATE POLICY "Service can manage cross agent insights"
ON public.cross_agent_insights FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_cross_agent_insights_updated_at
BEFORE UPDATE ON public.cross_agent_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();