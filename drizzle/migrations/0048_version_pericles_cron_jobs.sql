-- Versionnement des taches planifiees de la boucle Pericles.
-- Les noms, les frequences et les corps d'appel sont decrits ici. Le jeton
-- d'appel n'apparait jamais dans la migration : il est lu au moment de
-- l'execution dans une table privee (aucun acces anon/authenticated).
CREATE TABLE IF NOT EXISTS public.cron_call_config (
  name text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cron_call_config TO service_role;
ALTER TABLE public.cron_call_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cron_call_config'
      AND policyname = 'Service role manages cron call config'
  ) THEN
    CREATE POLICY "Service role manages cron call config"
      ON public.cron_call_config FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Appel HTTP d'une fonction edge par une tache planifiee.
CREATE OR REPLACE FUNCTION public.cron_post(p_function text, p_body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_base text;
  v_token text;
  v_request_id bigint;
BEGIN
  SELECT value INTO v_base FROM public.cron_call_config WHERE name = 'functions_base_url';
  SELECT value INTO v_token FROM public.cron_call_config WHERE name = 'functions_token';

  IF v_base IS NULL OR v_token IS NULL THEN
    RAISE EXCEPTION 'Configuration d''appel des taches planifiees incomplete (cron_call_config)';
  END IF;

  SELECT net.http_post(
    url := v_base || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := COALESCE(p_body, '{}'::jsonb),
    timeout_milliseconds := 120000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_post(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_post(text, jsonb) TO service_role;

-- Declaration versionnee des taches de la boucle Pericles.
CREATE OR REPLACE FUNCTION public.ensure_pericles_crons()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job record;
  v_applied text[] := '{}';
BEGIN
  FOR v_job IN
    SELECT * FROM (VALUES
      ('autopilot-engine-cycle',           '0 * * * *',    $q$SELECT public.cron_post('autopilot-engine', '{}'::jsonb);$q$),
      ('autopilot-validate-deployed-cron', '0 */2 * * *',  $q$SELECT public.cron_post('autopilot-validate-deployed', '{"trigger":"cron"}'::jsonb);$q$),
      ('parmenion-feedback-daily',         '0 3 * * *',    $q$SELECT public.cron_post('parmenion-feedback', '{"all":true}'::jsonb);$q$),
      ('measure-audit-impact-weekly',      '0 3 * * 1',    $q$SELECT public.cron_post('measure-audit-impact', '{"source":"cron"}'::jsonb);$q$),
      ('compute-spiral-signals-6h',        '15 */6 * * *', $q$SELECT public.cron_post('compute-spiral-signals', '{"all":true}'::jsonb);$q$),
      ('pericles-measure-rewards-daily',   '20 3 * * *',   $q$SELECT public.pericles_measure_rewards(NULL, 500, 14);$q$)
    ) AS t(jobname, schedule, command)
  LOOP
    BEGIN
      PERFORM cron.unschedule(v_job.jobname);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(v_job.jobname, v_job.schedule, v_job.command);
    v_applied := v_applied || v_job.jobname;
  END LOOP;

  RETURN jsonb_build_object('scheduled', v_applied);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_pericles_crons() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_pericles_crons() TO service_role;