ALTER TABLE public.async_jobs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_async_jobs_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_async_jobs_touch ON public.async_jobs;
CREATE TRIGGER trg_async_jobs_touch BEFORE UPDATE ON public.async_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_async_jobs_updated_at();

CREATE OR REPLACE FUNCTION public.reap_zombie_async_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reaped_count integer;
BEGIN
  -- 1) Jobs réellement bloqués EN EXÉCUTION : aucune progression depuis 15 min.
  UPDATE public.async_jobs j
  SET status='failed',
      error_message='Edge function killed (CPU wall-time exceeded) — auto-reaped',
      completed_at=now()
  WHERE j.status = 'processing'
    AND COALESCE(j.updated_at, j.started_at, j.created_at) < now() - interval '15 minutes';
  GET DIAGNOSTICS reaped_count = ROW_COUNT;

  -- 2) Jobs en file d'attente : légitimes tant qu'un job de la même fonction
  -- tourne (batch séquentiel type Marina multipages). On ne les échoue que si
  -- la file est orpheline depuis 30 min, ou au bout de 3 h dans tous les cas.
  UPDATE public.async_jobs j
  SET status='failed',
      error_message='Timeout: job resté en file d''attente sans worker actif',
      completed_at=now()
  WHERE j.status = 'pending'
    AND (
      j.created_at < now() - interval '3 hours'
      OR (
        j.created_at < now() - interval '30 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM public.async_jobs p
          WHERE p.function_name = j.function_name
            AND p.status = 'processing'
        )
      )
    );
  reaped_count := reaped_count + (SELECT 0);
  RETURN reaped_count;
END;
$$;