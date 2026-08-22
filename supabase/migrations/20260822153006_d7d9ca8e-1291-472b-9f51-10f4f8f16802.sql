CREATE TABLE public.marketplace_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  leg_id uuid,
  method text NOT NULL CHECK (method IN ('crawl','linkedin_api','meta_api')),
  verdict text NOT NULL CHECK (verdict IN ('ok','hard_broken','soft_broken','blocked','inconclusive')),
  link_present boolean,
  observed_attribute text,
  observed_anchor text,
  http_status integer,
  render_escalated boolean NOT NULL DEFAULT false,
  shell_detected boolean NOT NULL DEFAULT false,
  leg_state text NOT NULL CHECK (leg_state IN ('published','verified','maintained','broken','resolved','refunded')),
  consecutive_failures integer NOT NULL DEFAULT 0,
  proof jsonb NOT NULL DEFAULT '{}'::jsonb,
  capture_path text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  next_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mkt_verifications_order ON public.marketplace_verifications(order_id, checked_at DESC);
CREATE INDEX idx_mkt_verifications_next ON public.marketplace_verifications(next_check_at) WHERE next_check_at IS NOT NULL;

GRANT SELECT ON public.marketplace_verifications TO authenticated;
GRANT ALL ON public.marketplace_verifications TO service_role;
ALTER TABLE public.marketplace_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties see their order verifications"
ON public.marketplace_verifications FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.marketplace_orders o
  WHERE o.id = marketplace_verifications.order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
));

CREATE TABLE public.marketplace_link_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_domain text NOT NULL,
  need_id uuid,
  need_score numeric NOT NULL DEFAULT 0,
  deficit_cede_cents integer NOT NULL DEFAULT 0,
  priority_score numeric NOT NULL DEFAULT 0,
  unserved_since timestamptz,
  reserved_until timestamptz,
  reserved_asset_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','reserved','served','expired')),
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_domain, need_id)
);

CREATE INDEX idx_mkt_link_queue_priority ON public.marketplace_link_queue(priority_score DESC) WHERE status = 'queued';

GRANT SELECT ON public.marketplace_link_queue TO authenticated;
GRANT ALL ON public.marketplace_link_queue TO service_role;
ALTER TABLE public.marketplace_link_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners see their own buy queue"
ON public.marketplace_link_queue FOR SELECT TO authenticated
USING (user_id = auth.uid());

ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS broken_since timestamptz,
  ADD COLUMN IF NOT EXISTS remediation_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_support text,
  ADD COLUMN IF NOT EXISTS consecutive_check_failures integer NOT NULL DEFAULT 0;

ALTER TABLE public.marketplace_balance_events
  ADD COLUMN IF NOT EXISTS reversal_of uuid REFERENCES public.marketplace_balance_events(id) ON DELETE SET NULL;

CREATE TRIGGER trg_mkt_link_queue_updated_at
BEFORE UPDATE ON public.marketplace_link_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();