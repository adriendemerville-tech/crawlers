-- Providers catalog
CREATE TABLE public.netlinking_providers (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text,
  docs_url text,
  status text NOT NULL DEFAULT 'active',
  supports_search boolean NOT NULL DEFAULT true,
  supports_order boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.netlinking_providers TO authenticated, anon;
GRANT ALL ON public.netlinking_providers TO service_role;

ALTER TABLE public.netlinking_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "providers_public_read" ON public.netlinking_providers
  FOR SELECT USING (true);

INSERT INTO public.netlinking_providers (slug, name, description, docs_url) VALUES
  ('accesslink', 'Accesslink.ai', 'Marketplace FR de backlinks automatisée avec catalogue live et livraison auto', 'https://accesslink.ai/api'),
  ('rocketlinks', 'Rocketlinks', 'Marketplace FR/EU premium de backlinks éditoriaux', 'https://www.rocketlinks.net'),
  ('getfluence', 'Getfluence', 'Placement sur éditeurs premium (Le Figaro, Le Monde, etc.)', 'https://www.getfluence.com');

-- Orders
CREATE TABLE public.netlinking_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_site_id uuid,
  provider_slug text NOT NULL REFERENCES public.netlinking_providers(slug),
  provider_order_id text,
  provider_offer_id text,
  target_url text NOT NULL,
  anchor_text text NOT NULL,
  topic text,
  publisher_domain text,
  publisher_metrics jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  cost_ht_cents integer NOT NULL DEFAULT 0,
  commission_cents integer NOT NULL DEFAULT 0,
  total_ht_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  live_url text,
  published_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT netlinking_orders_status_check CHECK (status IN ('draft','pending','confirmed','in_progress','live','rejected','refunded','cancelled'))
);

CREATE UNIQUE INDEX netlinking_orders_provider_ref_uniq
  ON public.netlinking_orders (provider_slug, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE INDEX netlinking_orders_user_idx ON public.netlinking_orders (user_id, created_at DESC);
CREATE INDEX netlinking_orders_status_idx ON public.netlinking_orders (status);

GRANT SELECT ON public.netlinking_orders TO authenticated;
GRANT ALL ON public.netlinking_orders TO service_role;

ALTER TABLE public.netlinking_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_owner_read" ON public.netlinking_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- All writes go through edge functions with service role. No INSERT/UPDATE/DELETE policies for regular users.

CREATE TRIGGER netlinking_orders_updated_at
  BEFORE UPDATE ON public.netlinking_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Catalog cache (24h TTL) for search results
CREATE TABLE public.netlinking_catalog_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  provider_slug text NOT NULL,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX netlinking_cache_expires_idx ON public.netlinking_catalog_cache (expires_at);

GRANT SELECT ON public.netlinking_catalog_cache TO authenticated;
GRANT ALL ON public.netlinking_catalog_cache TO service_role;

ALTER TABLE public.netlinking_catalog_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cache_authenticated_read" ON public.netlinking_catalog_cache
  FOR SELECT TO authenticated USING (true);