
-- GMB Locations: link a tracked site to a Google Business Profile location
CREATE TABLE public.gmb_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  place_id TEXT,
  address TEXT,
  phone TEXT,
  website TEXT,
  category TEXT,
  hours JSONB DEFAULT '{}',
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tracked_site_id)
);

ALTER TABLE public.gmb_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own GMB locations"
  ON public.gmb_locations FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- GMB Reviews: store fetched reviews
CREATE TABLE public.gmb_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmb_location_id UUID NOT NULL REFERENCES public.gmb_locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_review_id TEXT,
  reviewer_name TEXT,
  reviewer_photo_url TEXT,
  star_rating INTEGER CHECK (star_rating BETWEEN 1 AND 5),
  comment TEXT,
  reply_comment TEXT,
  reply_updated_at TIMESTAMPTZ,
  review_created_at TIMESTAMPTZ,
  is_flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gmb_location_id, google_review_id)
);

ALTER TABLE public.gmb_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own GMB reviews"
  ON public.gmb_reviews FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- GMB Posts: store published posts
CREATE TABLE public.gmb_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmb_location_id UUID NOT NULL REFERENCES public.gmb_locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL DEFAULT 'STANDARD',
  summary TEXT,
  media_url TEXT,
  call_to_action JSONB,
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gmb_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own GMB posts"
  ON public.gmb_posts FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- GMB Performance snapshots: weekly stats
CREATE TABLE public.gmb_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmb_location_id UUID NOT NULL REFERENCES public.gmb_locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  search_views INTEGER DEFAULT 0,
  maps_views INTEGER DEFAULT 0,
  website_clicks INTEGER DEFAULT 0,
  direction_requests INTEGER DEFAULT 0,
  phone_calls INTEGER DEFAULT 0,
  photo_views INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  avg_rating NUMERIC(2,1) DEFAULT 0,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gmb_location_id, week_start_date)
);

ALTER TABLE public.gmb_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own GMB performance"
  ON public.gmb_performance FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_gmb_locations_updated_at
  BEFORE UPDATE ON public.gmb_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gmb_reviews_updated_at
  BEFORE UPDATE ON public.gmb_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gmb_posts_updated_at
  BEFORE UPDATE ON public.gmb_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
