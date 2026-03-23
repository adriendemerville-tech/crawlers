
CREATE TABLE public.matomo_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  matomo_url text NOT NULL,
  site_id integer NOT NULL,
  auth_token text,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tracked_site_id)
);

ALTER TABLE public.matomo_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own matomo connections"
  ON public.matomo_connections FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.matomo_history_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  total_users integer DEFAULT 0,
  sessions integer DEFAULT 0,
  pageviews integer DEFAULT 0,
  bounce_rate numeric DEFAULT 0,
  avg_session_duration numeric DEFAULT 0,
  actions_per_visit numeric DEFAULT 0,
  measured_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (tracked_site_id, week_start_date)
);

ALTER TABLE public.matomo_history_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own matomo history"
  ON public.matomo_history_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage matomo history"
  ON public.matomo_history_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_matomo_connections_updated_at
  BEFORE UPDATE ON public.matomo_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
