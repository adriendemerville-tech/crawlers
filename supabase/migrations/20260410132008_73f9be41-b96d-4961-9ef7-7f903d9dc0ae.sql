
-- =============================================
-- SOCIAL CONTENT HUB — Phase 1 Migration
-- =============================================

-- 1. SOCIAL ACCOUNTS (OAuth connections)
CREATE TABLE public.social_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'instagram')),
  account_name TEXT,
  account_id TEXT,
  page_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own social accounts"
  ON public.social_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Team members view owner social accounts"
  ON public.social_accounts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.agency_team_members
    WHERE member_user_id = auth.uid() AND owner_user_id = social_accounts.user_id
  ));

CREATE INDEX idx_social_accounts_user ON public.social_accounts(user_id);
CREATE INDEX idx_social_accounts_site ON public.social_accounts(tracked_site_id);

CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. SOCIAL TEMPLATES (visual canvas templates)
CREATE TABLE public.social_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  platform TEXT CHECK (platform IN ('linkedin', 'facebook', 'instagram', 'universal')),
  canvas_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  variables JSONB DEFAULT '[]'::jsonb,
  thumbnail_url TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates"
  ON public.social_templates FOR ALL
  USING (auth.uid() = user_id OR is_system = true)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System templates visible to all authenticated"
  ON public.social_templates FOR SELECT
  TO authenticated
  USING (is_system = true);

CREATE INDEX idx_social_templates_user ON public.social_templates(user_id);

CREATE TRIGGER update_social_templates_updated_at
  BEFORE UPDATE ON public.social_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. SOCIAL POSTS (content per platform)
CREATE TABLE public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.social_templates(id) ON DELETE SET NULL,
  title TEXT,
  content_linkedin TEXT,
  content_facebook TEXT,
  content_instagram TEXT,
  hashtags TEXT[] DEFAULT '{}',
  mentions JSONB DEFAULT '[]'::jsonb,
  smart_link_url TEXT,
  smart_link_short TEXT,
  utm_params JSONB DEFAULT '{}'::jsonb,
  image_urls TEXT[] DEFAULT '{}',
  canvas_data JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  external_ids JSONB DEFAULT '{}'::jsonb,
  publish_platforms TEXT[] DEFAULT '{}',
  error_message TEXT,
  workbench_item_id UUID,
  seasonal_context_id UUID,
  source_keyword TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own posts"
  ON public.social_posts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Team members view owner posts"
  ON public.social_posts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.agency_team_members
    WHERE member_user_id = auth.uid() AND owner_user_id = social_posts.user_id
  ));

CREATE INDEX idx_social_posts_user ON public.social_posts(user_id);
CREATE INDEX idx_social_posts_status ON public.social_posts(status);
CREATE INDEX idx_social_posts_scheduled ON public.social_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_social_posts_site ON public.social_posts(tracked_site_id);

CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. SOCIAL CALENDARS (editorial calendar events)
CREATE TABLE public.social_calendars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  recurrence TEXT CHECK (recurrence IN ('none', 'daily', 'weekly', 'biweekly', 'monthly')),
  recurrence_end DATE,
  color TEXT DEFAULT '#3b82f6',
  post_id UUID REFERENCES public.social_posts(id) ON DELETE SET NULL,
  seasonal_context_id UUID,
  platforms TEXT[] DEFAULT '{}',
  is_auto_generated BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calendar"
  ON public.social_calendars FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Team members view owner calendar"
  ON public.social_calendars FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.agency_team_members
    WHERE member_user_id = auth.uid() AND owner_user_id = social_calendars.user_id
  ));

CREATE INDEX idx_social_calendars_user ON public.social_calendars(user_id);
CREATE INDEX idx_social_calendars_date ON public.social_calendars(event_date);

CREATE TRIGGER update_social_calendars_updated_at
  BEFORE UPDATE ON public.social_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. SOCIAL POST METRICS (engagement stats)
CREATE TABLE public.social_post_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'instagram')),
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  reach INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  raw_data JSONB DEFAULT '{}'::jsonb,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own post metrics"
  ON public.social_post_metrics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.social_posts sp WHERE sp.id = social_post_metrics.post_id AND sp.user_id = auth.uid()
  ));

CREATE POLICY "Service inserts metrics"
  ON public.social_post_metrics FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.social_posts sp WHERE sp.id = social_post_metrics.post_id AND sp.user_id = auth.uid()
  ));

CREATE INDEX idx_social_post_metrics_post ON public.social_post_metrics(post_id);
CREATE INDEX idx_social_post_metrics_platform ON public.social_post_metrics(platform);
CREATE INDEX idx_social_post_metrics_measured ON public.social_post_metrics(measured_at);

-- 6. SOCIAL IMAGE ASSETS (generated visuals)
CREATE TABLE public.social_image_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID REFERENCES public.social_posts(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT DEFAULT 'image/png',
  width INTEGER,
  height INTEGER,
  generation_prompt TEXT,
  canvas_snapshot JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_image_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own image assets"
  ON public.social_image_assets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_social_image_assets_user ON public.social_image_assets(user_id);
CREATE INDEX idx_social_image_assets_post ON public.social_image_assets(post_id);

-- 7. QUOTA: Add social_posts_this_month to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_posts_this_month INTEGER DEFAULT 0;

-- 8. STORAGE BUCKET for social images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('social-images', 'social-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read social images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'social-images');

CREATE POLICY "Users upload own social images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'social-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own social images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'social-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own social images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'social-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 9. Enable realtime for social_posts (for live status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
