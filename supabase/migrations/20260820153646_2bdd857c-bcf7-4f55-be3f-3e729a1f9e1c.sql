CREATE TABLE IF NOT EXISTS public.content_freshness_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.blog_articles(id) ON DELETE CASCADE,
  slug text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  priority_score numeric NOT NULL DEFAULT 0,
  staleness_days integer,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  outdated_years text[] NOT NULL DEFAULT '{}',
  dead_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  gsc_signals jsonb,
  draft_content text,
  draft_summary jsonb,
  draft_model text,
  draft_generated_at timestamptz,
  detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  published_at timestamptz,
  indexing_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_freshness_queue_status_chk
    CHECK (status IN ('pending', 'draft_ready', 'approved', 'dismissed')),
  CONSTRAINT content_freshness_queue_article_uniq UNIQUE (article_id)
);

CREATE INDEX IF NOT EXISTS idx_cfq_status_priority
  ON public.content_freshness_queue (status, priority_score DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_freshness_queue TO authenticated;
GRANT ALL ON public.content_freshness_queue TO service_role;

ALTER TABLE public.content_freshness_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage content freshness queue" ON public.content_freshness_queue;
CREATE POLICY "Admins manage content freshness queue"
ON public.content_freshness_queue
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_content_freshness_queue()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_content_freshness_queue ON public.content_freshness_queue;
CREATE TRIGGER trg_touch_content_freshness_queue
BEFORE UPDATE ON public.content_freshness_queue
FOR EACH ROW EXECUTE FUNCTION public.touch_content_freshness_queue();