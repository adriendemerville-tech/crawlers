-- Grand livre d'équilibrage réseau de la marketplace : autorité vs visibilité

CREATE TABLE IF NOT EXISTS public.marketplace_balance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  site_domain text NOT NULL,
  order_id uuid,
  order_source text NOT NULL DEFAULT 'marketplace',
  direction text NOT NULL,
  currency_kind text NOT NULL,
  trade_type text,
  leg text,
  value_cents integer NOT NULL DEFAULT 0,
  reciprocal_discount numeric NOT NULL DEFAULT 1.0,
  amortization_months integer NOT NULL DEFAULT 24,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mbe_direction_check CHECK (direction IN ('received','given')),
  CONSTRAINT mbe_currency_kind_check CHECK (currency_kind IN ('link','linkedin','instagram','credits','cash')),
  CONSTRAINT mbe_value_check CHECK (value_cents >= 0),
  CONSTRAINT mbe_discount_check CHECK (reciprocal_discount > 0 AND reciprocal_discount <= 1)
);

CREATE INDEX IF NOT EXISTS mbe_site_idx ON public.marketplace_balance_events (lower(site_domain), occurred_at DESC);
CREATE INDEX IF NOT EXISTS mbe_user_idx ON public.marketplace_balance_events (user_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS mbe_order_leg_uniq
  ON public.marketplace_balance_events (order_source, order_id, lower(site_domain), direction, currency_kind)
  WHERE order_id IS NOT NULL;

GRANT SELECT ON public.marketplace_balance_events TO authenticated;
GRANT ALL ON public.marketplace_balance_events TO service_role;
ALTER TABLE public.marketplace_balance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mbe_owner_read" ON public.marketplace_balance_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.marketplace_site_balances (
  site_domain text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  authority_balance_cents integer NOT NULL DEFAULT 0,
  visibility_balance_cents integer NOT NULL DEFAULT 0,
  authority_given_cents integer NOT NULL DEFAULT 0,
  authority_received_cents integer NOT NULL DEFAULT 0,
  legs_count integer NOT NULL DEFAULT 0,
  can_sell_link boolean NOT NULL DEFAULT true,
  buyer_priority_score integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.marketplace_site_balances TO authenticated;
GRANT ALL ON public.marketplace_site_balances TO service_role;
ALTER TABLE public.marketplace_site_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msb_owner_read" ON public.marketplace_site_balances
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Recalcul amorti (~24 mois de décroissance linéaire) pour un site
CREATE OR REPLACE FUNCTION public.recompute_marketplace_site_balance(p_site_domain text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text := lower(trim(p_site_domain));
  v_auth_recv numeric := 0;
  v_auth_given numeric := 0;
  v_vis numeric := 0;
  v_legs integer := 0;
  v_user uuid;
  v_authority integer;
  v_priority integer;
BEGIN
  IF v_domain IS NULL OR v_domain = '' THEN
    RETURN jsonb_build_object('error', 'missing_domain');
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN currency_kind = 'link' AND direction = 'received' THEN amortized END), 0),
    COALESCE(SUM(CASE WHEN currency_kind = 'link' AND direction = 'given'    THEN amortized END), 0),
    COALESCE(SUM(CASE WHEN currency_kind IN ('linkedin','instagram')
                      THEN CASE WHEN direction = 'received' THEN amortized ELSE -amortized END END), 0),
    COUNT(*)
  INTO v_auth_recv, v_auth_given, v_vis, v_legs
  FROM (
    SELECT
      currency_kind,
      direction,
      value_cents * reciprocal_discount
        * GREATEST(0, 1 - (EXTRACT(EPOCH FROM (now() - occurred_at)) / 2592000.0)
                        / GREATEST(amortization_months, 1)) AS amortized
    FROM public.marketplace_balance_events
    WHERE lower(site_domain) = v_domain
  ) amort;

  SELECT user_id INTO v_user
  FROM public.marketplace_balance_events
  WHERE lower(site_domain) = v_domain AND user_id IS NOT NULL
  ORDER BY occurred_at DESC LIMIT 1;

  v_authority := ROUND(v_auth_recv - v_auth_given)::integer;
  -- Priorité acheteur : proportionnelle au déficit d'autorité (0 si créditeur)
  v_priority := LEAST(100, GREATEST(0, ROUND((-v_authority)::numeric / 100)))::integer;

  INSERT INTO public.marketplace_site_balances AS b (
    site_domain, user_id, authority_balance_cents, visibility_balance_cents,
    authority_given_cents, authority_received_cents, legs_count,
    can_sell_link, buyer_priority_score, computed_at, updated_at
  ) VALUES (
    v_domain, v_user, v_authority, ROUND(v_vis)::integer,
    ROUND(v_auth_given)::integer, ROUND(v_auth_recv)::integer, v_legs,
    v_authority > -15000, v_priority, now(), now()
  )
  ON CONFLICT (site_domain) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, b.user_id),
    authority_balance_cents = EXCLUDED.authority_balance_cents,
    visibility_balance_cents = EXCLUDED.visibility_balance_cents,
    authority_given_cents = EXCLUDED.authority_given_cents,
    authority_received_cents = EXCLUDED.authority_received_cents,
    legs_count = EXCLUDED.legs_count,
    can_sell_link = EXCLUDED.can_sell_link,
    buyer_priority_score = EXCLUDED.buyer_priority_score,
    computed_at = now(),
    updated_at = now();

  RETURN jsonb_build_object(
    'site_domain', v_domain,
    'authority_balance_cents', v_authority,
    'visibility_balance_cents', ROUND(v_vis)::integer,
    'legs_count', v_legs,
    'can_sell_link', v_authority > -15000,
    'buyer_priority_score', v_priority
  );
END;
$$;

-- Enregistrement d'une jambe livrée (vente ou achat de lien / story / post)
CREATE OR REPLACE FUNCTION public.record_marketplace_balance_event(
  p_site_domain text,
  p_direction text,
  p_currency_kind text,
  p_value_cents integer,
  p_user_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_order_source text DEFAULT 'marketplace',
  p_trade_type text DEFAULT NULL,
  p_leg text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now(),
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text := lower(trim(p_site_domain));
  v_discount numeric := 1.0;
BEGIN
  IF v_domain IS NULL OR v_domain = '' THEN
    RETURN jsonb_build_object('error', 'missing_domain');
  END IF;
  -- Décote réciproque : un lien issu d'un link_for_link vaut moins
  IF p_trade_type = 'link_for_link' AND p_currency_kind = 'link' THEN
    v_discount := 0.6;
  END IF;

  INSERT INTO public.marketplace_balance_events (
    user_id, site_domain, order_id, order_source, direction, currency_kind,
    trade_type, leg, value_cents, reciprocal_discount,
    amortization_months, occurred_at, metadata
  ) VALUES (
    p_user_id, v_domain, p_order_id, COALESCE(p_order_source, 'marketplace'),
    p_direction, p_currency_kind, p_trade_type, p_leg,
    GREATEST(COALESCE(p_value_cents, 0), 0), v_discount,
    CASE WHEN p_currency_kind = 'link' THEN 24 ELSE 3 END,
    COALESCE(p_occurred_at, now()), COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT DO NOTHING;

  RETURN public.recompute_marketplace_site_balance(v_domain);
END;
$$;

-- Réamortissement global (cron quotidien)
CREATE OR REPLACE FUNCTION public.recompute_all_marketplace_balances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT DISTINCT lower(site_domain) AS d FROM public.marketplace_balance_events LOOP
    PERFORM public.recompute_marketplace_site_balance(r.d);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- Hook automatique : une commande de lien passée "live" crédite l'autorité de l'acheteur
-- et débite celle du site éditeur vendeur.
CREATE OR REPLACE FUNCTION public.tg_netlinking_order_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_domain text;
  v_value integer;
BEGIN
  IF NEW.status <> 'live' OR (TG_OP = 'UPDATE' AND OLD.status = 'live') THEN
    RETURN NEW;
  END IF;

  v_value := GREATEST(COALESCE(NEW.total_ht_cents, NEW.cost_ht_cents, 0), 0);
  v_buyer_domain := lower(regexp_replace(
    regexp_replace(COALESCE(NEW.target_url, ''), '^https?://(www\.)?', ''), '/.*$', ''));

  IF v_buyer_domain <> '' THEN
    PERFORM public.record_marketplace_balance_event(
      v_buyer_domain, 'received', 'link', v_value, NEW.user_id, NEW.id,
      'netlinking', NULL, 'buyer', COALESCE(NEW.published_at, now()),
      jsonb_build_object('publisher_domain', NEW.publisher_domain, 'anchor', NEW.anchor_text)
    );
  END IF;

  IF COALESCE(NEW.publisher_domain, '') <> '' THEN
    PERFORM public.record_marketplace_balance_event(
      NEW.publisher_domain, 'given', 'link', v_value, NULL, NEW.id,
      'netlinking', NULL, 'seller', COALESCE(NEW.published_at, now()),
      jsonb_build_object('target_url', NEW.target_url)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS netlinking_orders_balance ON public.netlinking_orders;
CREATE TRIGGER netlinking_orders_balance
  AFTER INSERT OR UPDATE OF status ON public.netlinking_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_netlinking_order_balance();

SELECT cron.schedule(
  'recompute-marketplace-balances-daily',
  '15 4 * * *',
  $cron$ SELECT public.recompute_all_marketplace_balances(); $cron$
);