CREATE TABLE public.passe_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url text,
  normalized_url text,
  gmb_location_id text,
  gmb_account_id text,
  status text NOT NULL DEFAULT 'created',
  step integer NOT NULL DEFAULT 1,
  findings jsonb DEFAULT '[]'::jsonb,
  paid_at timestamptz,
  deployed_at timestamptz,
  report jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.passe_order_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.passe_orders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic text NOT NULL,
  title text,
  outline jsonb DEFAULT '[]'::jsonb,
  draft_html text,
  client_revision text,
  revision_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.passe_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.passe_orders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.passe_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.passe_orders(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  pass_token text NOT NULL UNIQUE,
  txn_id text,
  amount_cents integer,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passe_orders TO authenticated;
GRANT ALL ON public.passe_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passe_order_contents TO authenticated;
GRANT ALL ON public.passe_order_contents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passe_order_events TO authenticated;
GRANT ALL ON public.passe_order_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passe_passes TO authenticated;
GRANT ALL ON public.passe_passes TO service_role;

ALTER TABLE public.passe_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passe_order_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passe_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passe_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own passe_orders"
  ON public.passe_orders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage passe_orders"
  ON public.passe_orders
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Users can manage own passe_order_contents"
  ON public.passe_order_contents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage passe_order_contents"
  ON public.passe_order_contents
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Users can manage own passe_order_events"
  ON public.passe_order_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage passe_order_events"
  ON public.passe_order_events
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Users can manage own passe_passes"
  ON public.passe_passes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage passe_passes"
  ON public.passe_passes
  FOR ALL
  TO service_role
  USING (true);

CREATE INDEX idx_passe_orders_user_id ON public.passe_orders(user_id);
CREATE INDEX idx_passe_orders_status ON public.passe_orders(status);
CREATE INDEX idx_passe_order_contents_order_id ON public.passe_order_contents(order_id);
CREATE INDEX idx_passe_order_events_order_id ON public.passe_order_events(order_id);
CREATE INDEX idx_passe_passes_token ON public.passe_passes(pass_token);
CREATE INDEX idx_passe_passes_user_id ON public.passe_passes(user_id);

CREATE OR REPLACE FUNCTION public.passe_validate_expires_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'expires_at must be in the future';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER passe_passes_expires_at_trigger
BEFORE INSERT OR UPDATE ON public.passe_passes
FOR EACH ROW EXECUTE FUNCTION public.passe_validate_expires_at();
