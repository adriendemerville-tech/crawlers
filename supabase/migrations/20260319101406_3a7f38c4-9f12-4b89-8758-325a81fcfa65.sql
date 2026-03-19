
CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  target_pages jsonb DEFAULT '[]'::jsonb,
  target_persona jsonb DEFAULT '{}'::jsonb,
  schedule_at timestamptz,
  duration_days integer DEFAULT 7,
  max_impressions_per_user integer DEFAULT 1,
  delay_between_impressions_hours integer DEFAULT 24,
  content_blocks jsonb DEFAULT '[]'::jsonb,
  ab_enabled boolean DEFAULT false,
  ab_ratio integer DEFAULT 50,
  variant_b_content_blocks jsonb,
  variant_b_target_persona jsonb,
  variant_b_duration_days integer,
  target_user_count integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.survey_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.surveys(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  variant text DEFAULT 'A',
  response_data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage surveys" ON public.surveys
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read active surveys" ON public.surveys
  FOR SELECT TO authenticated
  USING (status = 'active');

CREATE POLICY "Users can insert own events" ON public.survey_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own events" ON public.survey_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all events" ON public.survey_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
