-- Table: raw test execution results per prompt per LLM
CREATE TABLE public.llm_test_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  llm_name text NOT NULL,
  prompt_tested text NOT NULL,
  response_text text,
  brand_found boolean NOT NULL DEFAULT false,
  iteration_found integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.llm_test_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own test executions"
  ON public.llm_test_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own test executions"
  ON public.llm_test_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_llm_test_exec_site ON public.llm_test_executions(tracked_site_id, created_at DESC);

-- Table: aggregated weekly visibility scores
CREATE TABLE public.llm_visibility_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  llm_name text NOT NULL,
  score_percentage integer NOT NULL DEFAULT 0,
  week_start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tracked_site_id, llm_name, week_start_date)
);

ALTER TABLE public.llm_visibility_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own visibility scores"
  ON public.llm_visibility_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own visibility scores"
  ON public.llm_visibility_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_llm_vis_scores_site ON public.llm_visibility_scores(tracked_site_id, week_start_date DESC);