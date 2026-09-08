ALTER TABLE public.passe_orders
  ADD COLUMN IF NOT EXISTS diagnostic jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fixes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tracked_site_id uuid,
  ADD COLUMN IF NOT EXISTS gmb_preview jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS site_deploy_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS gmb_deploy_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS snapshot jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.passe_order_contents
  ADD COLUMN IF NOT EXISTS cms_id text,
  ADD COLUMN IF NOT EXISTS published_url text;

CREATE INDEX IF NOT EXISTS idx_passe_orders_user_status ON public.passe_orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_passe_order_events_order ON public.passe_order_events (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.passe_free_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  normalized_url text NOT NULL,
  score integer,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.passe_free_diagnostics TO authenticated;
GRANT ALL ON public.passe_free_diagnostics TO service_role;
ALTER TABLE public.passe_free_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages free diagnostics" ON public.passe_free_diagnostics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_passe_free_diag_ip ON public.passe_free_diagnostics (ip_hash, created_at DESC);