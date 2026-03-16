
CREATE TABLE public.cocoon_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  recommendation_text text NOT NULL,
  summary varchar(100) NOT NULL,
  source_context jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cocoon_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cocoon recommendations"
  ON public.cocoon_recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cocoon recommendations"
  ON public.cocoon_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cocoon recommendations"
  ON public.cocoon_recommendations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_cocoon_recommendations_site ON public.cocoon_recommendations(tracked_site_id, created_at DESC);
