-- L3.1 — socle transactionnel de la Place d'échange

DO $$ BEGIN
  CREATE TYPE public.marketplace_variant_kind AS ENUM ('editorial', 'utility_geo', 'action');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.marketplace_dispute_status AS ENUM ('open', 'acknowledged', 'resolved', 'appealed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Commandes ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_domain text NOT NULL,
  seller_domain text NOT NULL,
  asset_id uuid NOT NULL,
  asset_kind public.marketplace_asset_kind NOT NULL DEFAULT 'link',
  need_id uuid,
  match_id uuid,
  target_url text NOT NULL,
  anchor text,
  anchor_kind public.marketplace_anchor_kind,
  link_attribute public.marketplace_link_attribute NOT NULL DEFAULT 'sponsored',
  need_attribute public.marketplace_link_attribute NOT NULL DEFAULT 'sponsored',
  permit_attribute public.marketplace_link_attribute NOT NULL DEFAULT 'sponsored',
  need_objective public.marketplace_need_objective,
  need_objective_source public.marketplace_need_objective_source,
  need_objective_confirmed_at timestamptz,
  dofollow_risk_ack_at timestamptz,
  attribute_basis jsonb NOT NULL DEFAULT '{}'::jsonb,
  deal_type public.marketplace_deal_type NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  commission_cents integer NOT NULL DEFAULT 0,
  commission_settlement public.marketplace_settlement_support NOT NULL DEFAULT 'cash',
  commission_support public.marketplace_settlement_support NOT NULL DEFAULT 'cash',
  buyer_payment_support text NOT NULL DEFAULT 'cash',
  commission_credits integer,
  credit_eur_rate_at_freeze numeric,
  soulte_cents integer NOT NULL DEFAULT 0,
  soulte_currency text NOT NULL DEFAULT 'eur',
  soulte_payer_id uuid,
  soulte_payee_id uuid,
  commitment_months integer NOT NULL DEFAULT 12,
  escrow_cents integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  commitment_ends_at timestamptz,
  status public.marketplace_order_status NOT NULL DEFAULT 'draft',
  approved_revision_id uuid,
  revision_rounds_used integer NOT NULL DEFAULT 0,
  risk_flags text[] NOT NULL DEFAULT '{}',
  constants_version integer,
  frozen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_orders_amount_cap CHECK (price_cents + soulte_cents <= 35000),
  CONSTRAINT marketplace_orders_amount_step CHECK (price_cents % 1000 = 0 AND soulte_cents % 1000 = 0),
  CONSTRAINT marketplace_orders_distinct_parties CHECK (buyer_id <> seller_id),
  CONSTRAINT marketplace_orders_buyer_support CHECK (buyer_payment_support IN ('cash', 'credits', 'barter')),
  CONSTRAINT marketplace_orders_soulte_currency CHECK (soulte_currency IN ('eur', 'credits'))
);

GRANT SELECT ON public.marketplace_orders TO authenticated;
GRANT ALL ON public.marketplace_orders TO service_role;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_orders_party_read" ON public.marketplace_orders
  FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_mp_orders_buyer ON public.marketplace_orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_orders_seller ON public.marketplace_orders (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_orders_status ON public.marketplace_orders (status);

-- Jambes ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  exchange_id uuid NOT NULL,
  leg_index integer NOT NULL,
  giver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  giver_domain text NOT NULL,
  receiver_domain text NOT NULL,
  currency_kind public.marketplace_currency_kind NOT NULL,
  trade_type public.marketplace_trade_type NOT NULL,
  value_cents integer NOT NULL,
  publish_after timestamptz,
  reciprocity_quarter text,
  cycle_check_verdict text,
  commission_payer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commission_cents integer NOT NULL DEFAULT 0,
  commission_credits integer,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_exchanges_value_bounds CHECK (value_cents BETWEEN 0 AND 35000),
  CONSTRAINT marketplace_exchanges_value_step CHECK (value_cents % 1000 = 0),
  CONSTRAINT marketplace_exchanges_leg_unique UNIQUE (order_id, leg_index)
);

GRANT SELECT ON public.marketplace_exchanges TO authenticated;
GRANT ALL ON public.marketplace_exchanges TO service_role;
ALTER TABLE public.marketplace_exchanges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_exchanges_party_read" ON public.marketplace_exchanges
  FOR SELECT TO authenticated USING (giver_id = auth.uid() OR receiver_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_mp_exchanges_order ON public.marketplace_exchanges (order_id);
CREATE INDEX IF NOT EXISTS idx_mp_exchanges_exchange ON public.marketplace_exchanges (exchange_id);

-- Versements -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  leg_id uuid REFERENCES public.marketplace_exchanges(id) ON DELETE SET NULL,
  beneficiary_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  support public.marketplace_settlement_support NOT NULL,
  amount_cents integer NOT NULL,
  amount_credits integer,
  status text NOT NULL DEFAULT 'pending',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_payouts_kind CHECK (kind IN ('seller_payout', 'commission', 'refund', 'soulte'))
);

GRANT SELECT ON public.marketplace_payouts TO authenticated;
GRANT ALL ON public.marketplace_payouts TO service_role;
ALTER TABLE public.marketplace_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_payouts_beneficiary_read" ON public.marketplace_payouts
  FOR SELECT TO authenticated USING (
    beneficiary_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.marketplace_orders o
      WHERE o.id = marketplace_payouts.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Variantes Studio -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_content_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  variant public.marketplace_variant_kind NOT NULL,
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  output text NOT NULL,
  anchor text,
  model text,
  cost_cents integer NOT NULL DEFAULT 0,
  round_index integer NOT NULL DEFAULT 1,
  seller_approved_at timestamptz,
  buyer_selected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_variants_unique UNIQUE (order_id, variant, round_index)
);

GRANT SELECT ON public.marketplace_content_variants TO authenticated;
GRANT ALL ON public.marketplace_content_variants TO service_role;
ALTER TABLE public.marketplace_content_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_variants_party_read" ON public.marketplace_content_variants
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_orders o
      WHERE o.id = marketplace_content_variants.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Révisions de lien ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_link_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.marketplace_content_variants(id) ON DELETE SET NULL,
  round_index integer NOT NULL,
  proposed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  html_before text,
  html_after text,
  paragraph_excerpt text,
  status text NOT NULL DEFAULT 'proposed',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_revisions_status CHECK (status IN ('proposed', 'accepted', 'refused'))
);

GRANT SELECT ON public.marketplace_link_revisions TO authenticated;
GRANT ALL ON public.marketplace_link_revisions TO service_role;
ALTER TABLE public.marketplace_link_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_revisions_party_read" ON public.marketplace_link_revisions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_orders o
      WHERE o.id = marketplace_link_revisions.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Retours bilatéraux ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  revision_id uuid REFERENCES public.marketplace_link_revisions(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.marketplace_content_variants(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role text NOT NULL,
  verdict text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_feedback_role CHECK (author_role IN ('buyer', 'seller')),
  CONSTRAINT marketplace_feedback_verdict CHECK (verdict IN ('accepted', 'refused', 'comment'))
);

GRANT SELECT ON public.marketplace_feedback TO authenticated;
GRANT ALL ON public.marketplace_feedback TO service_role;
ALTER TABLE public.marketplace_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_feedback_party_read" ON public.marketplace_feedback
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_orders o
      WHERE o.id = marketplace_feedback.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Factures -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  leg_id uuid REFERENCES public.marketplace_exchanges(id) ON DELETE SET NULL,
  kind public.marketplace_invoice_kind NOT NULL,
  issuer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  series text NOT NULL,
  number integer NOT NULL,
  amount_cents integer NOT NULL,
  vat_cents integer NOT NULL DEFAULT 0,
  vat_rule text,
  credit_eur_rate numeric,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  dac7_reportable boolean NOT NULL DEFAULT false,
  issued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_invoices_series_unique UNIQUE (series, number)
);

GRANT SELECT ON public.marketplace_invoices TO authenticated;
GRANT ALL ON public.marketplace_invoices TO service_role;
ALTER TABLE public.marketplace_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_invoices_party_read" ON public.marketplace_invoices
  FOR SELECT TO authenticated USING (issuer_id = auth.uid() OR recipient_id = auth.uid());

-- Litiges --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason public.marketplace_dispute_reason NOT NULL,
  detail text,
  status public.marketplace_dispute_status NOT NULL DEFAULT 'open',
  acknowledged_at timestamptz,
  due_at timestamptz,
  decision public.marketplace_dispute_decision,
  decision_outcome text,
  decision_notes text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  appeal_of uuid REFERENCES public.marketplace_disputes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_disputes_outcome CHECK (
    decision_outcome IS NULL
    OR decision_outcome IN ('upheld', 'cancelled_no_fee', 'prorata_refund', 'forced_execution')
  )
);

GRANT SELECT ON public.marketplace_disputes TO authenticated;
GRANT ALL ON public.marketplace_disputes TO service_role;
ALTER TABLE public.marketplace_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_disputes_party_read" ON public.marketplace_disputes
  FOR SELECT TO authenticated USING (
    opened_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.marketplace_orders o
      WHERE o.id = marketplace_disputes.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_disputes_one_appeal ON public.marketplace_disputes (appeal_of)
  WHERE appeal_of IS NOT NULL;

CREATE TRIGGER trg_mp_orders_updated_at
  BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Constantes L3 --------------------------------------------------------------
INSERT INTO public.marketplace_pricing_constants (version, key, value, active)
SELECT (SELECT max(version) FROM public.marketplace_pricing_constants), k.key, k.value, true
FROM (VALUES
  ('commitment_months', '{"link": 12, "linkedin": 1, "story": 0}'::jsonb),
  ('dispute_sla_days', '5'::jsonb),
  ('dispute_ack_hours', '24'::jsonb),
  ('link_for_link_quarter_quota', '1'::jsonb),
  ('link_chain_leg_delay_days', '7'::jsonb),
  ('credit_eur_rate', '0.01'::jsonb)
) AS k(key, value)
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketplace_pricing_constants c
  WHERE c.key = k.key AND c.active
);