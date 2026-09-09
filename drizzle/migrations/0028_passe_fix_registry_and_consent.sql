-- Registre des correctifs de la passe unique + consentement unique de délégation.

CREATE TABLE public.passe_order_fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.passe_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  family text NOT NULL,
  fix_key text NOT NULL,
  injection_slug text,
  label text NOT NULL,
  detail text NOT NULL DEFAULT '',
  page_url text,
  channel text NOT NULL DEFAULT 'manual',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'proposed',
  seo_impact text NOT NULL DEFAULT 'medium',
  rollback_ref text,
  error_detail text,
  deployed_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT passe_order_fixes_status_check CHECK (status IN ('proposed','authorized','declined','deployed','failed','reverted','not_applicable')),
  CONSTRAINT passe_order_fixes_channel_check CHECK (channel IN ('content','code','redirect','image','gmb','root_file','manual')),
  CONSTRAINT passe_order_fixes_impact_check CHECK (seo_impact IN ('high','medium','low')),
  CONSTRAINT passe_order_fixes_unique UNIQUE (order_id, fix_key, page_url)
);

CREATE INDEX idx_passe_order_fixes_order ON public.passe_order_fixes(order_id);
CREATE INDEX idx_passe_order_fixes_status ON public.passe_order_fixes(order_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passe_order_fixes TO authenticated;
GRANT ALL ON public.passe_order_fixes TO service_role;

ALTER TABLE public.passe_order_fixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own passe fixes select" ON public.passe_order_fixes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own passe fixes insert" ON public.passe_order_fixes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own passe fixes update" ON public.passe_order_fixes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own passe fixes delete" ON public.passe_order_fixes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Consentement : une seule délégation par commande.
CREATE TABLE public.passe_order_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.passe_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  authorized_fix_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  declined_fix_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  summary_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_passe_order_consents_user ON public.passe_order_consents(user_id);

GRANT SELECT, INSERT ON public.passe_order_consents TO authenticated;
GRANT ALL ON public.passe_order_consents TO service_role;

ALTER TABLE public.passe_order_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own passe consent select" ON public.passe_order_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own passe consent insert" ON public.passe_order_consents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
