
-- Bug reports from users via Assistant Crawler
CREATE TABLE public.user_bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  raw_message TEXT NOT NULL,
  translated_message TEXT,
  category TEXT DEFAULT 'bug_ui',
  route TEXT,
  context_data JSONB DEFAULT '{}',
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  cto_response TEXT,
  resolved_at TIMESTAMPTZ,
  notified_user BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_user_bug_reports_user_id ON public.user_bug_reports(user_id);
CREATE INDEX idx_user_bug_reports_status ON public.user_bug_reports(status);

-- Auto-update updated_at
CREATE TRIGGER update_user_bug_reports_updated_at
  BEFORE UPDATE ON public.user_bug_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.user_bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can read their own reports
CREATE POLICY "Users can read own bug reports"
  ON public.user_bug_reports FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own reports
CREATE POLICY "Users can insert own bug reports"
  ON public.user_bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can read all reports
CREATE POLICY "Admins can read all bug reports"
  ON public.user_bug_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all reports (resolve, respond)
CREATE POLICY "Admins can update all bug reports"
  ON public.user_bug_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
