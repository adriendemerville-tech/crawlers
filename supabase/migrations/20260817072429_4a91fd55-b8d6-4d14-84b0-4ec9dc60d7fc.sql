-- 1) Correction du calcul des benchmarks de mix de gabarits :
--    percentile_cont renvoie double precision, round(double precision, int) n'existe pas.
CREATE OR REPLACE FUNCTION public.refresh_archetype_mix_benchmarks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows INTEGER;
BEGIN
  WITH obs AS (
    SELECT o.sector_normalized,
           o.commercial_model,
           k.key AS archetype_key,
           (k.value->>'share')::numeric AS share,
           o.domain_hash
    FROM public.market_observations o,
         jsonb_each(o.archetype_mix) k
    WHERE o.sector_normalized <> 'unknown'
      AND o.created_at > now() - interval '180 days'
      AND jsonb_typeof(k.value) = 'object'
      AND (k.value->>'share') ~ '^[0-9.]+$'
  ),
  per_domain AS (
    SELECT sector_normalized, commercial_model, archetype_key, domain_hash, avg(share) AS share
    FROM obs
    GROUP BY 1, 2, 3, 4
  ),
  agg AS (
    SELECT sector_normalized, commercial_model, archetype_key,
           percentile_cont(0.2) WITHIN GROUP (ORDER BY share)::numeric AS p20,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY share)::numeric AS p50,
           percentile_cont(0.8) WITHIN GROUP (ORDER BY share)::numeric AS p80,
           count(DISTINCT domain_hash)::int AS sample_size
    FROM per_domain
    GROUP BY 1, 2, 3
  )
  INSERT INTO public.archetype_mix_benchmarks
    (sector_normalized, commercial_model, archetype_key, p20, p50, p80, sample_size, updated_at)
  SELECT sector_normalized, commercial_model, archetype_key,
         round(p20, 4), round(p50, 4), round(p80, 4), sample_size, now()
  FROM agg
  WHERE sample_size >= 5
  ON CONFLICT (sector_normalized, commercial_model, archetype_key) DO UPDATE
    SET p20 = EXCLUDED.p20,
        p50 = EXCLUDED.p50,
        p80 = EXCLUDED.p80,
        sample_size = EXCLUDED.sample_size,
        updated_at = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$function$;

-- 2) VACUUM ne peut pas tourner dans un bloc transactionnel : pg_cron enveloppe
--    les commandes multi-instructions. On découpe en un job par table.
SELECT cron.unschedule('vacuum-hot-tables');
SELECT cron.schedule('vacuum-crawl-jobs',       '0 4 * * *', 'VACUUM ANALYZE public.crawl_jobs');
SELECT cron.schedule('vacuum-blog-articles',    '5 4 * * *', 'VACUUM ANALYZE public.blog_articles');
SELECT cron.schedule('vacuum-tracked-sites',    '10 4 * * *', 'VACUUM ANALYZE public.tracked_sites');
SELECT cron.schedule('vacuum-analytics-events', '15 4 * * *', 'VACUUM ANALYZE public.analytics_events');
SELECT cron.schedule('vacuum-crawl-pages',      '20 4 * * *', 'VACUUM ANALYZE public.crawl_pages');

-- 3) Dispatcher générique : relance les async_jobs restés en 'pending' faute
--    d'auto-invocation réussie (fire-and-forget perdu). Marina exclu : il a
--    son propre cron de reprise par phase.
CREATE OR REPLACE FUNCTION public.resume_pending_async_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_key text;
  v_count integer := 0;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key';
  IF v_key IS NULL THEN RETURN 0; END IF;

  FOR r IN
    SELECT id, function_name, input_payload
    FROM async_jobs
    WHERE status = 'pending'
      AND function_name <> 'marina'
      AND created_at < now() - interval '2 minutes'
      AND created_at > now() - interval '3 hours'
      AND COALESCE((input_payload->>'_resume_attempts')::int, 0) < 3
    ORDER BY created_at
    LIMIT 10
  LOOP
    PERFORM net.http_post(
      url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/' || r.function_name,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := COALESCE(r.input_payload, '{}'::jsonb)
              || jsonb_build_object('async', false, '_job_id', r.id::text, '_resumed', true)
    );

    UPDATE async_jobs
    SET input_payload = COALESCE(input_payload, '{}'::jsonb)
      || jsonb_build_object('_resume_attempts', COALESCE((input_payload->>'_resume_attempts')::int, 0) + 1),
        updated_at = now()
    WHERE id = r.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

SELECT cron.schedule('resume-pending-async-jobs-3min', '*/3 * * * *', 'SELECT public.resume_pending_async_jobs()');

-- 4) Le faucheur ne doit tuer un job pending qu'après épuisement des relances,
--    et le message doit décrire la cause réelle.
CREATE OR REPLACE FUNCTION public.reap_zombie_async_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reaped_count integer;
BEGIN
  UPDATE public.async_jobs j
  SET status='failed',
      error_message='Edge function killed (CPU wall-time exceeded) — auto-reaped',
      completed_at=now()
  WHERE j.status = 'processing'
    AND COALESCE(j.updated_at, j.started_at, j.created_at) < now() - interval '15 minutes'
    AND NOT (
      j.function_name = 'marina'
      AND COALESCE(j.updated_at, j.started_at, j.created_at) > now() - interval '90 minutes'
      AND EXISTS (
        SELECT 1 FROM public.audit_cache c
        WHERE c.cache_key = 'marina_checkpoint_' || j.id::text
          AND (c.expires_at IS NULL OR c.expires_at > now())
          AND COALESCE((c.result_data->>'resumes')::int, 0) < 6
      )
    );
  GET DIAGNOSTICS reaped_count = ROW_COUNT;

  UPDATE public.async_jobs j
  SET status='failed',
      error_message='Job jamais démarré : auto-invocation perdue et '
        || COALESCE((j.input_payload->>'_resume_attempts'), '0')
        || ' relance(s) sans succès',
      completed_at=now()
  WHERE j.status = 'pending'
    AND (
      j.created_at < now() - interval '3 hours'
      OR (
        j.created_at < now() - interval '30 minutes'
        AND COALESCE((j.input_payload->>'_resume_attempts')::int, 0) >= 3
      )
    );
  RETURN reaped_count;
END;
$$;