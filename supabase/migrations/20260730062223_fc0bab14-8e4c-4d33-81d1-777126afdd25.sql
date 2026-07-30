ALTER TABLE public.linkedin_scheduled_posts
  ADD COLUMN IF NOT EXISTS audit_status TEXT,
  ADD COLUMN IF NOT EXISTS audit_score INTEGER,
  ADD COLUMN IF NOT EXISTS audit_report JSONB,
  ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audit_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_li_posts_audit_pending
  ON public.linkedin_scheduled_posts (published_at)
  WHERE status = 'published' AND audited_at IS NULL;