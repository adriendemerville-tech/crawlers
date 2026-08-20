CREATE TABLE IF NOT EXISTS public.link_health_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'sitemap',
  title text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical','warning','info')),
  priority_score integer NOT NULL DEFAULT 0,
  links_checked integer NOT NULL DEFAULT 0,
  broken_count integer NOT NULL DEFAULT 0,
  internal_broken jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_broken jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetch_error text,
  first_detected_at timestamptz,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_health_queue_status ON public.link_health_queue (status, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_link_health_queue_rotation ON public.link_health_queue (last_checked_at ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_health_queue TO authenticated;
GRANT ALL ON public.link_health_queue TO service_role;

ALTER TABLE public.link_health_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage link health queue" ON public.link_health_queue;
CREATE POLICY "Admins manage link health queue"
ON public.link_health_queue
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_link_health_queue_updated_at
BEFORE UPDATE ON public.link_health_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();