-- Aligner les statuts crawlers_api_jobs (succeeded/completed acceptés)
ALTER TABLE public.crawlers_api_jobs DROP CONSTRAINT IF EXISTS crawlers_api_jobs_status_check;
ALTER TABLE public.crawlers_api_jobs ADD CONSTRAINT crawlers_api_jobs_status_check
  CHECK (status = ANY (ARRAY['queued','running','succeeded','completed','failed','cancelled']));

-- Table webhooks développeurs
CREATE TABLE public.developer_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api text NOT NULL CHECK (api IN ('crawlers','marina','parmenion')),
  url text NOT NULL,
  secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events text[] NOT NULL DEFAULT ARRAY['job.completed','job.failed']::text[],
  active boolean NOT NULL DEFAULT true,
  last_ping_at timestamptz,
  last_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_developer_webhooks_user ON public.developer_webhooks(user_id, api) WHERE active;
ALTER TABLE public.developer_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own webhooks" ON public.developer_webhooks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access webhooks" ON public.developer_webhooks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER developer_webhooks_updated_at
  BEFORE UPDATE ON public.developer_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit des livraisons
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.developer_webhooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event text NOT NULL,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','retrying')),
  response_status integer,
  response_body text,
  error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_user ON public.webhook_deliveries(user_id, created_at DESC);
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role full access deliveries" ON public.webhook_deliveries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Vue d'agrégation cross-API
CREATE OR REPLACE VIEW public.developer_usage_daily
WITH (security_invoker = true)
AS
SELECT
  user_id,
  'crawlers'::text AS api,
  feature,
  date_trunc('day', created_at)::date AS day,
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status IN ('succeeded','completed'))::int AS succeeded,
  COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
FROM public.crawlers_api_jobs
GROUP BY user_id, feature, date_trunc('day', created_at)

UNION ALL

SELECT
  user_id,
  'parmenion'::text AS api,
  action_type AS feature,
  date_trunc('day', created_at)::date AS day,
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status = 'completed')::int AS succeeded,
  COUNT(*) FILTER (WHERE status = 'failed' OR is_error)::int AS failed
FROM public.parmenion_decision_log
GROUP BY user_id, action_type, date_trunc('day', created_at);

GRANT SELECT ON public.developer_usage_daily TO authenticated;