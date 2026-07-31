CREATE TABLE public.conversion_visual_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tracked_site_id uuid NOT NULL,
  analysis_id uuid,
  page_url text NOT NULL,
  desktop_screenshot_url text,
  mobile_screenshot_url text,
  video_url text,
  frictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_elements jsonb NOT NULL DEFAULT '{}'::jsonb,
  friction_score integer,
  status text NOT NULL DEFAULT 'ready',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cvc_site_created ON public.conversion_visual_captures (tracked_site_id, created_at DESC);
CREATE INDEX idx_cvc_user ON public.conversion_visual_captures (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversion_visual_captures TO authenticated;
GRANT ALL ON public.conversion_visual_captures TO service_role;

ALTER TABLE public.conversion_visual_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own conversion captures"
ON public.conversion_visual_captures FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);