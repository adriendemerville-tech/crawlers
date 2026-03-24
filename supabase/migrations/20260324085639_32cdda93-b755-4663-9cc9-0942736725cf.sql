CREATE TABLE public.gmb_tracked_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tracked_site_id uuid REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  source text DEFAULT 'suggestion',
  search_volume integer,
  current_position integer,
  previous_position integer,
  position_change integer,
  last_checked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.gmb_tracked_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own gmb keywords"
  ON public.gmb_tracked_keywords
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());