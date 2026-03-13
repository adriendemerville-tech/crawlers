
-- Table dédiée SERP KPIs (redondance structurée)
CREATE TABLE public.serp_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_site_id uuid NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  total_keywords integer NOT NULL DEFAULT 0,
  avg_position numeric,
  homepage_position integer,
  top_3 integer NOT NULL DEFAULT 0,
  top_10 integer NOT NULL DEFAULT 0,
  top_50 integer NOT NULL DEFAULT 0,
  etv integer NOT NULL DEFAULT 0,
  sample_keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_serp_snapshots_site ON public.serp_snapshots(tracked_site_id, measured_at DESC);
CREATE INDEX idx_serp_snapshots_user ON public.serp_snapshots(user_id);

-- RLS
ALTER TABLE public.serp_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own serp snapshots"
  ON public.serp_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all serp snapshots"
  ON public.serp_snapshots FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
