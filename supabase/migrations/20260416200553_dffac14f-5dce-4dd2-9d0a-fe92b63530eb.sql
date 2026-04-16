-- ============================================
-- 1. EDITORIAL LLM ROUTING (matrice domaine × type)
-- ============================================
CREATE TABLE public.editorial_llm_routing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  content_type TEXT NOT NULL,
  strategist_model TEXT,
  writer_model TEXT,
  tonalizer_model TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain, content_type)
);

CREATE INDEX idx_editorial_llm_routing_lookup 
  ON public.editorial_llm_routing(user_id, domain, content_type);

ALTER TABLE public.editorial_llm_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own routing"
  ON public.editorial_llm_routing FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own routing"
  ON public.editorial_llm_routing FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own routing"
  ON public.editorial_llm_routing FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own routing"
  ON public.editorial_llm_routing FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 2. EDITORIAL BRIEFING PACKETS (étage 0 snapshots)
-- ============================================
CREATE TABLE public.editorial_briefing_packets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  tracked_site_id UUID,
  content_type TEXT NOT NULL,
  target_url TEXT,
  briefing_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  workbench_item_ids UUID[] DEFAULT ARRAY[]::UUID[],
  spiral_phase TEXT,
  consumed_at TIMESTAMP WITH TIME ZONE,
  consumed_by_pipeline_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_editorial_briefing_user_domain 
  ON public.editorial_briefing_packets(user_id, domain, created_at DESC);

CREATE INDEX idx_editorial_briefing_unconsumed 
  ON public.editorial_briefing_packets(user_id, consumed_at) 
  WHERE consumed_at IS NULL;

ALTER TABLE public.editorial_briefing_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own briefings"
  ON public.editorial_briefing_packets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own briefings"
  ON public.editorial_briefing_packets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own briefings"
  ON public.editorial_briefing_packets FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. EDITORIAL PIPELINE LOGS (observabilité 4 étages)
-- ============================================
CREATE TABLE public.editorial_pipeline_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  pipeline_run_id UUID NOT NULL,
  content_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  model_used TEXT,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  latency_ms INTEGER,
  cost_usd NUMERIC(10, 6),
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_editorial_pipeline_logs_run 
  ON public.editorial_pipeline_logs(pipeline_run_id, created_at);

CREATE INDEX idx_editorial_pipeline_logs_user_domain 
  ON public.editorial_pipeline_logs(user_id, domain, created_at DESC);

ALTER TABLE public.editorial_pipeline_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pipeline logs"
  ON public.editorial_pipeline_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role inserts pipeline logs"
  ON public.editorial_pipeline_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. TIMESTAMP TRIGGERS
-- ============================================
CREATE TRIGGER trg_editorial_llm_routing_updated_at
  BEFORE UPDATE ON public.editorial_llm_routing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();