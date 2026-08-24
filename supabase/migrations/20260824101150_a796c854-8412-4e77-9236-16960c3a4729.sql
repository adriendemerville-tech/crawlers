CREATE TABLE public.marketplace_social_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram','linkedin')),
  account_id text NOT NULL,
  account_name text,
  social_account_id uuid,
  tracked_site_id uuid,
  site_domain text,
  formats jsonb NOT NULL DEFAULT '["feed"]'::jsonb,
  followers integer,
  reach_avg integer,
  impressions_avg integer,
  engagement_rate numeric,
  audience_geo jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  creative_quality numeric,
  metrics_window_start timestamptz,
  metrics_window_end timestamptz,
  metrics_source text,
  follower_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  opted_in boolean NOT NULL DEFAULT false,
  ownership_status public.marketplace_ownership_status NOT NULL DEFAULT 'unverified',
  price_cents integer,
  price_tier public.marketplace_price_tier,
  prices_by_format jsonb NOT NULL DEFAULT '{}'::jsonb,
  pricing_basis jsonb NOT NULL DEFAULT '{}'::jsonb,
  vendable boolean NOT NULL DEFAULT false,
  unvendable_reason text,
  constants_version integer,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, account_id)
);

GRANT SELECT ON public.marketplace_social_assets TO authenticated;
GRANT ALL ON public.marketplace_social_assets TO service_role;

ALTER TABLE public.marketplace_social_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social assets readable by owner"
  ON public.marketplace_social_assets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "opted-in social assets readable by authenticated"
  ON public.marketplace_social_assets FOR SELECT TO authenticated
  USING (opted_in AND ownership_status = 'verified' AND vendable);

CREATE TRIGGER update_marketplace_social_assets_updated_at
  BEFORE UPDATE ON public.marketplace_social_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_marketplace_social_assets_user ON public.marketplace_social_assets (user_id);

INSERT INTO public.marketplace_pricing_constants (version, key, value, active, note) VALUES
  (1, 'insta_base_format', '{"feed": 9000, "reel": 12000, "story": 5000}'::jsonb, true, 'Base Collab par format, en centimes (§3)'),
  (1, 'insta_curve_f', '{"points": [[0,0.40],[1000,0.70],[5000,1.00],[20000,1.40],[100000,1.90],[500000,2.40]]}'::jsonb, true, 'f(reach moyen) — interpolation lineaire'),
  (1, 'insta_curve_g', '{"points": [[0,0.50],[0.01,0.80],[0.03,1.00],[0.06,1.25],[0.12,1.50]]}'::jsonb, true, 'g(taux engagement reel)'),
  (1, 'insta_curve_h', '{"points": [[0,0.60],[0.30,0.80],[0.60,1.00],[0.85,1.15],[1,1.25]]}'::jsonb, true, 'h(affinite thematique audience/acheteur)'),
  (1, 'insta_curve_k', '{"points": [[0,0.80],[0.50,1.00],[1,1.15]]}'::jsonb, true, 'k(qualite creative)'),
  (1, 'insta_fraud_thresholds', '{"engagement_rate_min": 0.005, "engagement_rate_max": 0.25, "follower_step_max_ratio": 0.15, "foreign_audience_max_ratio": 0.60, "reach_follower_max_ratio": 3.0}'::jsonb, true, 'Anti-fraude Collab (reach achete, escaliers de followers, audience incoherente)'),
  (1, 'insta_min_metrics_days', '28'::jsonb, true, 'Fenetre minimale de metriques pour tarifer un compte'),
  (1, 'insta_insights_delay_days', '7'::jsonb, true, 'Delai de releve des insights post-publication'),
  (1, 'insta_compliance_tags', '["#pub","#sponso","#sponsorise","#collaborationcommerciale","partenariat remunere","publicite"]'::jsonb, true, 'Mentions de conformite acceptees (ARPP/FTC)');