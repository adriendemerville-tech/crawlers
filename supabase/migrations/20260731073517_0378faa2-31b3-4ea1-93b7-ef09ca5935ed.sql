ALTER TABLE public.linkedin_scheduled_posts
  ADD COLUMN IF NOT EXISTS pre_publish_score integer,
  ADD COLUMN IF NOT EXISTS pre_publish_report jsonb;