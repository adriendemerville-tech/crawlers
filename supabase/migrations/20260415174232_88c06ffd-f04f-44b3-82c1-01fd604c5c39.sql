
-- Priority levels: 10=agency_premium, 20=agency_pro, 30=new_user (<24h), 40=registered
CREATE TYPE public.job_status AS ENUM ('queued', 'processing', 'done', 'failed', 'cancelled');

CREATE TABLE public.job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INT NOT NULL DEFAULT 40,
  plan_type TEXT DEFAULT 'free',
  status public.job_status NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  locked_until TIMESTAMPTZ,
  locked_by TEXT,
  result_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for worker polling: pick highest priority (lowest number) first, then oldest
CREATE INDEX idx_job_queue_poll ON public.job_queue (priority ASC, created_at ASC) WHERE status = 'queued';
CREATE INDEX idx_job_queue_user ON public.job_queue (user_id, created_at DESC);
CREATE INDEX idx_job_queue_status ON public.job_queue (status) WHERE status IN ('queued', 'processing');

-- RLS
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
  ON public.job_queue FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own jobs"
  ON public.job_queue FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Rate limit token bucket
CREATE TABLE public.rate_limit_tokens (
  id TEXT PRIMARY KEY DEFAULT 'global',
  tokens INT NOT NULL DEFAULT 30,
  max_tokens INT NOT NULL DEFAULT 30,
  last_refill_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  refill_rate_per_sec NUMERIC NOT NULL DEFAULT 20
);

INSERT INTO public.rate_limit_tokens (id, tokens, max_tokens, refill_rate_per_sec)
VALUES ('llm_global', 30, 30, 20);

-- Function to atomically claim N jobs with optimistic locking
CREATE OR REPLACE FUNCTION public.claim_jobs(batch_size INT DEFAULT 10, worker_id TEXT DEFAULT 'default')
RETURNS SETOF public.job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.job_queue
    WHERE status = 'queued'
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY priority ASC, created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.job_queue q
  SET status = 'processing',
      locked_until = now() + interval '10 minutes',
      locked_by = worker_id,
      started_at = now(),
      attempts = attempts + 1,
      updated_at = now()
  FROM candidates c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;

-- Function to resolve priority from plan_type + account age
CREATE OR REPLACE FUNCTION public.resolve_job_priority(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_created TIMESTAMPTZ;
BEGIN
  SELECT plan_type, created_at INTO v_plan, v_created
  FROM public.profiles
  WHERE user_id = p_user_id;

  -- agency_premium = 10 (highest)
  IF v_plan = 'agency_premium' THEN RETURN 10; END IF;
  -- agency_pro = 20
  IF v_plan = 'agency_pro' THEN RETURN 20; END IF;
  -- new user (<24h) = 30
  IF v_created > now() - interval '24 hours' THEN RETURN 30; END IF;
  -- registered = 40
  RETURN 40;
END;
$$;
