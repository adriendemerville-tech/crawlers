-- L2.1 Place d'échange : besoins, appariements, valeurs, garde-fous acheteur

CREATE TABLE public.marketplace_needs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  tracked_site_id uuid,
  target_url text NOT NULL,
  need_type public.marketplace_need_type NOT NULL,
  need_primary public.marketplace_need_objective NOT NULL,
  need_secondary public.marketplace_need_objective,
  severity text NOT NULL DEFAULT 'medium',
  authority_deficit numeric NOT NULL DEFAULT 0,
  need_score numeric NOT NULL DEFAULT 0,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  workbench_item_id uuid,
  need_objective public.marketplace_need_objective,
  need_objective_source public.marketplace_need_objective_source,
  need_objective_confirmed_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  constants_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX marketplace_needs_unique ON public.marketplace_needs (user_id, target_url, need_type);
CREATE INDEX marketplace_needs_domain_idx ON public.marketplace_needs (user_id, domain, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_needs TO authenticated;
GRANT ALL ON public.marketplace_needs TO service_role;
ALTER TABLE public.marketplace_needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "needs_owner_all" ON public.marketplace_needs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.marketplace_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  need_id uuid NOT NULL REFERENCES public.marketplace_needs(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.marketplace_link_assets(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL,
  buyer_domain text NOT NULL,
  seller_user_id uuid NOT NULL,
  seller_domain text NOT NULL,
  compat_score numeric NOT NULL DEFAULT 0,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  projected_attribute public.marketplace_link_attribute NOT NULL DEFAULT 'sponsored',
  attribute_basis jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_cents integer NOT NULL DEFAULT 0,
  price_tier public.marketplace_price_tier,
  status text NOT NULL DEFAULT 'proposed',
  constants_version integer NOT NULL DEFAULT 1,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE UNIQUE INDEX marketplace_matches_unique ON public.marketplace_matches (need_id, asset_id);
CREATE INDEX marketplace_matches_buyer_idx ON public.marketplace_matches (buyer_user_id, compat_score DESC);
CREATE INDEX marketplace_matches_seller_idx ON public.marketplace_matches (seller_user_id, compat_score DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_matches TO authenticated;
GRANT ALL ON public.marketplace_matches TO service_role;
ALTER TABLE public.marketplace_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_party_select" ON public.marketplace_matches FOR SELECT TO authenticated
  USING (auth.uid() = buyer_user_id OR auth.uid() = seller_user_id);
CREATE POLICY "matches_buyer_write" ON public.marketplace_matches FOR ALL TO authenticated
  USING (auth.uid() = buyer_user_id) WITH CHECK (auth.uid() = buyer_user_id);

CREATE TABLE public.marketplace_match_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  scope text NOT NULL,
  domain text NOT NULL,
  url text NOT NULL DEFAULT '',
  seller_face numeric NOT NULL DEFAULT 0,
  buyer_face numeric NOT NULL DEFAULT 0,
  sell_potential_cents integer NOT NULL DEFAULT 0,
  buy_need_score numeric NOT NULL DEFAULT 0,
  balance_cents integer NOT NULL DEFAULT 0,
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  constants_version integer NOT NULL DEFAULT 1,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE UNIQUE INDEX marketplace_match_values_unique ON public.marketplace_match_values (user_id, scope, domain, url);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_match_values TO authenticated;
GRANT ALL ON public.marketplace_match_values TO service_role;
ALTER TABLE public.marketplace_match_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_values_owner_all" ON public.marketplace_match_values FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.marketplace_buyer_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  links_7d integer NOT NULL DEFAULT 0,
  links_30d integer NOT NULL DEFAULT 0,
  per_seller_12m jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_url_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  exact_anchor_ratio numeric NOT NULL DEFAULT 0,
  topical_coherence numeric NOT NULL DEFAULT 1,
  buy_risk numeric NOT NULL DEFAULT 0,
  next_allowed_at timestamptz,
  throttle_reason text,
  constants_version integer NOT NULL DEFAULT 1,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX marketplace_buyer_limits_user_unique ON public.marketplace_buyer_limits (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_buyer_limits TO authenticated;
GRANT ALL ON public.marketplace_buyer_limits TO service_role;
ALTER TABLE public.marketplace_buyer_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyer_limits_owner_all" ON public.marketplace_buyer_limits FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER marketplace_needs_updated_at BEFORE UPDATE ON public.marketplace_needs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Constantes L2 (même version active)
INSERT INTO public.marketplace_pricing_constants (version, key, value, active)
SELECT max(version), k.key, k.value, true
FROM public.marketplace_pricing_constants, (VALUES
  ('buyer_limits', '{"links_per_7d": 2, "links_per_30d": 4, "per_seller_12m": 2, "same_target_url_12m": 2, "exact_anchor_max_ratio": 0.3, "topical_coherence_min": 0.35}'::jsonb),
  ('match_weights', '{"topical": 0.35, "authority_fit": 0.25, "risk": 0.2, "geo_fit": 0.1, "balance": 0.1}'::jsonb),
  ('match_min_score', '0.35'::jsonb),
  ('match_value_ttl_hours', '24'::jsonb)
) AS k(key, value)
WHERE active
GROUP BY k.key, k.value;