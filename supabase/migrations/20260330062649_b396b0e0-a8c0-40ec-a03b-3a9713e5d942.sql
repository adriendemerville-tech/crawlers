
-- Content monitoring log table
CREATE TABLE IF NOT EXISTS public.content_monitor_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  url_checked TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'autopilot', 'content_architect', 'cocoon'
  source_record_id TEXT, -- reference to modification_log, batch_operation, etc.
  
  -- Expected vs detected content elements
  expected_title TEXT,
  detected_title TEXT,
  expected_meta_desc TEXT,
  detected_meta_desc TEXT,
  expected_h1 TEXT,
  detected_h1 TEXT,
  expected_content_hash TEXT,
  detected_content_hash TEXT,
  
  -- Schema.org check
  expected_schema_types TEXT[], -- e.g. ['FAQPage', 'Product']
  detected_schema_types TEXT[],
  
  -- Result
  status TEXT NOT NULL DEFAULT 'ok', -- ok, content_changed, content_missing, elements_altered, fetch_failed
  changed_elements TEXT[], -- ['title', 'meta_desc', 'h1', 'schema', 'body_content']
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_monitor_log_site_created 
  ON public.content_monitor_log(tracked_site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_monitor_log_status 
  ON public.content_monitor_log(status) WHERE status != 'ok';

ALTER TABLE public.content_monitor_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own content monitor logs"
  ON public.content_monitor_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Track deployed content snapshots for comparison
CREATE TABLE IF NOT EXISTS public.content_deploy_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_site_id UUID REFERENCES public.tracked_sites(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  page_url TEXT NOT NULL,
  deployed_title TEXT,
  deployed_meta_desc TEXT,
  deployed_h1 TEXT,
  deployed_content_hash TEXT,
  deployed_schema_types TEXT[],
  source_type TEXT NOT NULL, -- 'autopilot', 'content_architect', 'cocoon', 'cms_patch'
  source_record_id TEXT,
  last_verified_at TIMESTAMPTZ,
  last_verification_status TEXT DEFAULT 'pending',
  consecutive_failures INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_deploy_snapshots_url 
  ON public.content_deploy_snapshots(tracked_site_id, page_url) WHERE is_active = true;

ALTER TABLE public.content_deploy_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own content snapshots"
  ON public.content_deploy_snapshots FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
