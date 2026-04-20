CREATE TABLE public.persona_rotation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  persona_key TEXT NOT NULL,
  persona_label TEXT NOT NULL,
  pain_points TEXT[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  last_served_at TIMESTAMPTZ,
  articles_count INT DEFAULT 0,
  cycle_number INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tracked_site_id, persona_key)
);

ALTER TABLE public.persona_rotation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own persona rotation"
  ON public.persona_rotation_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own persona rotation"
  ON public.persona_rotation_log FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access persona rotation"
  ON public.persona_rotation_log FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_persona_rotation_site ON public.persona_rotation_log(tracked_site_id);
CREATE INDEX idx_persona_rotation_last_served ON public.persona_rotation_log(tracked_site_id, last_served_at ASC NULLS FIRST);