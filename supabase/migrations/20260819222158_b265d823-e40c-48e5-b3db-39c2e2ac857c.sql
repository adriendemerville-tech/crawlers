CREATE TABLE public.marina_network_syntheses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  domain text NOT NULL,
  urls_audited integer NOT NULL DEFAULT 0,
  regime text NOT NULL,
  tech_avg numeric,
  geo_avg numeric,
  tech_geo_gap numeric,
  mesh_edges integer NOT NULL DEFAULT 0,
  mesh_measured boolean NOT NULL DEFAULT false,
  measured_duplicates integer NOT NULL DEFAULT 0,
  missing_hubs integer NOT NULL DEFAULT 0,
  structure_verified boolean NOT NULL DEFAULT false,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marina_network_syntheses TO authenticated;
GRANT ALL ON public.marina_network_syntheses TO service_role;

ALTER TABLE public.marina_network_syntheses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own network syntheses"
  ON public.marina_network_syntheses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_marina_network_syntheses_domain
  ON public.marina_network_syntheses (user_id, domain, created_at DESC);