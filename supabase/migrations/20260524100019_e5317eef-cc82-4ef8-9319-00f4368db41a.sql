
-- Table de planification des crawls automatiques par site
CREATE TABLE IF NOT EXISTS public.site_crawl_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  last_full_crawl_at timestamptz,
  last_full_crawl_id uuid,
  last_targeted_crawl_at timestamptz,
  last_targeted_directory text,
  directories jsonb NOT NULL DEFAULT '[]'::jsonb,
  full_interval_days integer NOT NULL DEFAULT 15,
  targeted_interval_days integer NOT NULL DEFAULT 5,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scs_domain ON public.site_crawl_schedule(domain);
CREATE INDEX IF NOT EXISTS idx_scs_enabled ON public.site_crawl_schedule(enabled) WHERE enabled = true;

ALTER TABLE public.site_crawl_schedule ENABLE ROW LEVEL SECURITY;

-- Admin/service only — pas d'accès utilisateur direct (managed by cron)
CREATE POLICY "Service role full access on site_crawl_schedule"
  ON public.site_crawl_schedule
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Owners can view their schedule"
  ON public.site_crawl_schedule
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_site_crawl_schedule_updated_at
  BEFORE UPDATE ON public.site_crawl_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
