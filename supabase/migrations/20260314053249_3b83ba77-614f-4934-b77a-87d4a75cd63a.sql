-- Table storing multiple Google OAuth connections per user
CREATE TABLE public.google_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  google_email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expiry timestamptz,
  ga4_property_id text,
  gsc_site_urls jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, google_email)
);

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON public.google_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own connections"
  ON public.google_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own connections"
  ON public.google_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own connections"
  ON public.google_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Link each tracked site to a specific Google connection
ALTER TABLE public.tracked_sites
  ADD COLUMN IF NOT EXISTS google_connection_id uuid REFERENCES public.google_connections(id) ON DELETE SET NULL DEFAULT null;