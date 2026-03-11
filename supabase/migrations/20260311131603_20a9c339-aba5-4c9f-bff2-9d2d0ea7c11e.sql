
-- Table de file d'attente pour les crawls asynchrones
CREATE TABLE public.crawl_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id uuid NOT NULL REFERENCES public.site_crawls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  url text NOT NULL,
  urls_to_process jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  processed_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  max_concurrent integer NOT NULL DEFAULT 20,
  error_message text,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- RLS
ALTER TABLE public.crawl_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view their own crawl jobs"
  ON public.crawl_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own crawl jobs
CREATE POLICY "Users can insert their own crawl jobs"
  ON public.crawl_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only service_role can update (worker)
CREATE POLICY "Service role can manage crawl jobs"
  ON public.crawl_jobs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for worker to find pending jobs efficiently
CREATE INDEX idx_crawl_jobs_status_priority ON public.crawl_jobs (status, priority DESC, created_at ASC);
