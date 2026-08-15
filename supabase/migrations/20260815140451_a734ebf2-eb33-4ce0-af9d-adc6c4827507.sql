-- 1. Pool mutualisé de volumes de recherche (partagé, non scopé par utilisateur)
CREATE TABLE IF NOT EXISTS public.keyword_volume_pool (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  geo TEXT NOT NULL DEFAULT 'fr',
  language TEXT NOT NULL DEFAULT 'fr',
  search_volume INTEGER,
  difficulty INTEGER,
  competition TEXT,
  cpc_usd NUMERIC,
  source TEXT NOT NULL DEFAULT 'keyword_planner',
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT keyword_volume_pool_unique UNIQUE (keyword, geo, language)
);

CREATE INDEX IF NOT EXISTS idx_kvp_fetched ON public.keyword_volume_pool (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_kvp_lookup ON public.keyword_volume_pool (geo, language, keyword);

GRANT SELECT ON public.keyword_volume_pool TO authenticated;
GRANT ALL ON public.keyword_volume_pool TO service_role;

ALTER TABLE public.keyword_volume_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read the shared volume pool" ON public.keyword_volume_pool;
CREATE POLICY "Authenticated users can read the shared volume pool"
ON public.keyword_volume_pool FOR SELECT TO authenticated USING (true);

-- 2. Support des comptes Ads gérés (MCC) pour l'en-tête login-customer-id
ALTER TABLE public.google_connections
  ADD COLUMN IF NOT EXISTS ads_login_customer_id TEXT;

-- 3. Cron hebdomadaire : backfill des volumes manquants via Keyword Planner
SELECT cron.unschedule('keyword-planner-volumes-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'keyword-planner-volumes-weekly');

SELECT cron.schedule(
  'keyword-planner-volumes-weekly',
  '15 5 * * 2',
  $$
  SELECT net.http_post(
    url := 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/keyword-planner-volumes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET_V2' LIMIT 1)
    ),
    body := jsonb_build_object('action', 'backfill_all'),
    timeout_milliseconds := 120000
  );
  $$
);