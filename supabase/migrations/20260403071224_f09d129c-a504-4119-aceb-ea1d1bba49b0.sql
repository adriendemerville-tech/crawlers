
-- Enum for connector types
CREATE TYPE public.log_connector_type AS ENUM (
  'cloudflare', 'agent', 'upload', 'wpengine', 'kinsta', 'sftp', 'aws', 'vercel', 'wordpress_plugin'
);

-- Enum for bot categories
CREATE TYPE public.bot_category AS ENUM (
  'search_engine', 'ai_crawler', 'seo_tool', 'social', 'unknown'
);

-- Connectors table
CREATE TABLE public.log_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type log_connector_type NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'error', 'pending')),
  config jsonb DEFAULT '{}'::jsonb,
  api_key_hash text,
  last_sync_at timestamptz,
  error_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Log entries table (normalized)
CREATE TABLE public.log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  connector_id uuid NOT NULL REFERENCES public.log_connectors(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL,
  ip inet,
  user_agent text,
  method text,
  path text,
  status_code int,
  bytes_sent int,
  referer text,
  country_code text,
  is_bot boolean NOT NULL DEFAULT false,
  bot_name text,
  bot_category bot_category,
  raw jsonb,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Connector errors table
CREATE TABLE public.log_connector_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES public.log_connectors(id) ON DELETE CASCADE,
  error text NOT NULL,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══ INDEXES ═══

-- log_connectors
CREATE INDEX idx_log_connectors_site ON public.log_connectors(tracked_site_id);
CREATE INDEX idx_log_connectors_type_status ON public.log_connectors(type, status);
CREATE INDEX idx_log_connectors_api_key_hash ON public.log_connectors(api_key_hash) WHERE api_key_hash IS NOT NULL;

-- log_entries (main query patterns)
CREATE INDEX idx_log_entries_site_ts ON public.log_entries(tracked_site_id, ts DESC);
CREATE INDEX idx_log_entries_connector ON public.log_entries(connector_id);
CREATE INDEX idx_log_entries_bot ON public.log_entries(tracked_site_id, is_bot, bot_category) WHERE is_bot = true;
CREATE INDEX idx_log_entries_status ON public.log_entries(tracked_site_id, status_code) WHERE status_code >= 400;
CREATE INDEX idx_log_entries_ts ON public.log_entries(ts DESC);

-- log_connector_errors
CREATE INDEX idx_log_connector_errors_connector ON public.log_connector_errors(connector_id, created_at DESC);

-- ═══ RLS ═══

ALTER TABLE public.log_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_connector_errors ENABLE ROW LEVEL SECURITY;

-- Helper function to check site ownership
CREATE OR REPLACE FUNCTION public.owns_tracked_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tracked_sites
    WHERE id = p_site_id AND user_id = auth.uid()
  )
$$;

-- log_connectors policies
CREATE POLICY "Users can view own connectors"
  ON public.log_connectors FOR SELECT TO authenticated
  USING (public.owns_tracked_site(tracked_site_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own connectors"
  ON public.log_connectors FOR INSERT TO authenticated
  WITH CHECK (public.owns_tracked_site(tracked_site_id) AND user_id = auth.uid());

CREATE POLICY "Users can update own connectors"
  ON public.log_connectors FOR UPDATE TO authenticated
  USING (public.owns_tracked_site(tracked_site_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own connectors"
  ON public.log_connectors FOR DELETE TO authenticated
  USING (public.owns_tracked_site(tracked_site_id));

-- log_entries policies
CREATE POLICY "Users can view own log entries"
  ON public.log_entries FOR SELECT TO authenticated
  USING (public.owns_tracked_site(tracked_site_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert log entries"
  ON public.log_entries FOR INSERT TO authenticated
  WITH CHECK (true);

-- log_connector_errors policies
CREATE POLICY "Users can view own connector errors"
  ON public.log_connector_errors FOR SELECT TO authenticated
  USING (
    connector_id IN (
      SELECT id FROM public.log_connectors WHERE public.owns_tracked_site(tracked_site_id)
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- ═══ TRIGGER ═══

CREATE TRIGGER update_log_connectors_updated_at
  BEFORE UPDATE ON public.log_connectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
