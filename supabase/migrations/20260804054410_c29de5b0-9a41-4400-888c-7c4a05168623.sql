-- 1. Deterministic cluster matcher for workbench items (no LLM)
CREATE OR REPLACE FUNCTION public.match_workbench_cluster(
  p_tracked_site_id uuid,
  p_text text
) RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cd.id
  FROM cluster_definitions cd
  CROSS JOIN LATERAL (
    SELECT MAX(length(k)) AS best
    FROM unnest(COALESCE(cd.keywords, ARRAY[]::text[])) AS k
    WHERE length(k) >= 4
      AND position(lower(k) IN lower(COALESCE(p_text, ''))) > 0
  ) m
  WHERE cd.tracked_site_id = p_tracked_site_id
    AND m.best IS NOT NULL
  ORDER BY m.best DESC, cd.ring ASC
  LIMIT 1;
$$;

-- 2. Auto-assign cluster_id on insert/update of workbench items
CREATE OR REPLACE FUNCTION public.tg_assign_workbench_cluster()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cluster_id IS NULL AND NEW.tracked_site_id IS NOT NULL THEN
    NEW.cluster_id := public.match_workbench_cluster(
      NEW.tracked_site_id,
      COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.target_url, '')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_workbench_cluster ON public.architect_workbench;
CREATE TRIGGER trg_assign_workbench_cluster
BEFORE INSERT OR UPDATE OF title, description, target_url
ON public.architect_workbench
FOR EACH ROW EXECUTE FUNCTION public.tg_assign_workbench_cluster();

-- 3. Backfill existing items
UPDATE public.architect_workbench w
SET cluster_id = public.match_workbench_cluster(
      w.tracked_site_id,
      COALESCE(w.title, '') || ' ' || COALESCE(w.description, '') || ' ' || COALESCE(w.target_url, '')
    )
WHERE w.cluster_id IS NULL
  AND w.tracked_site_id IS NOT NULL;

-- 4. Schedule the Breathing Spiral signal engine (was never scheduled)
SELECT cron.unschedule('compute-spiral-signals-6h') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'compute-spiral-signals-6h'
);
SELECT cron.schedule(
  'compute-spiral-signals-6h',
  '15 */6 * * *',
  $CRON$
  SELECT net.http_post(
    url:='https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/compute-spiral-signals',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dGxpbXRhc25qYWJkZmhwZXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDk4MjMsImV4cCI6MjA4NDY4NTgyM30.RESxwIV0nhWCryZ5AxHEKQI5hhPw6Iiy5YLZXcl91FE"}'::jsonb,
    body:=concat('{"triggered_at":"', now(), '"}')::jsonb
  );
  $CRON$
);