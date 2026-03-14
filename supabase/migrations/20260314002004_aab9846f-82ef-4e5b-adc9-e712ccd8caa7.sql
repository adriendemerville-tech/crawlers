
CREATE TABLE public.seo_agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type text NOT NULL DEFAULT 'blog',
  page_slug text NOT NULL,
  page_url text NOT NULL,
  action_type text NOT NULL DEFAULT 'content_improvement',
  changes_summary text NOT NULL,
  changes_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_score_before integer,
  seo_score_after integer,
  confidence_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'applied',
  model_used text NOT NULL DEFAULT 'gemini-2.5-flash',
  tokens_used jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage seo agent logs"
  ON public.seo_agent_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_seo_agent_logs_page ON public.seo_agent_logs(page_slug, created_at DESC);
CREATE INDEX idx_seo_agent_logs_created ON public.seo_agent_logs(created_at DESC);
