
-- Table for storing local competitor snapshots from Google Maps
CREATE TABLE public.gmb_local_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  gmb_location_id UUID NOT NULL REFERENCES public.gmb_locations(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  competitor_place_id TEXT,
  competitor_address TEXT,
  competitor_category TEXT,
  competitor_website TEXT,
  competitor_phone TEXT,
  avg_rating NUMERIC(2,1),
  total_reviews INTEGER,
  maps_position INTEGER,
  previous_position INTEGER,
  position_change INTEGER DEFAULT 0,
  distance_km NUMERIC(5,2),
  search_query TEXT,
  snapshot_week DATE NOT NULL DEFAULT date_trunc('week', now())::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gmb_location_id, competitor_place_id, snapshot_week)
);

-- RLS
ALTER TABLE public.gmb_local_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own local competitors"
  ON public.gmb_local_competitors FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage local competitors"
  ON public.gmb_local_competitors FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_gmb_local_competitors_location_week 
  ON public.gmb_local_competitors(gmb_location_id, snapshot_week DESC);

-- Updated_at trigger
CREATE TRIGGER update_gmb_local_competitors_updated_at
  BEFORE UPDATE ON public.gmb_local_competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
