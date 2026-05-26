
CREATE TABLE public.ai_routing_overrides (
  feature TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  provider TEXT NOT NULL DEFAULT 'groq' CHECK (provider IN ('groq','lovable')),
  model TEXT NOT NULL,
  original_model TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.ai_routing_overrides TO authenticated;
GRANT ALL ON public.ai_routing_overrides TO service_role;

ALTER TABLE public.ai_routing_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_routing_read_authenticated"
  ON public.ai_routing_overrides FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "ai_routing_admin_write"
  ON public.ai_routing_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.ai_routing_overrides (feature, label, enabled, provider, model, original_model, description) VALUES
  ('editorial_tonalizer','Tonalisateur (étape 4 pipeline éditorial)', false, 'groq', 'llama-3.3-70b-versatile', 'google/gemini-2.5-flash', 'Réécriture stylistique du draft selon le Voice DNA. Pas de raisonnement, pur formatage.'),
  ('cocoon_anchor_variants','Variantes d''ancres (cocoon-auto-linking)', false, 'groq', 'llama-3.3-70b-versatile', 'google/gemini-2.5-flash', 'Génération de 3 ancres alternatives pour les liens internes.'),
  ('meta_alt_generator','Meta description & alt text (SEO)', false, 'groq', 'llama-3.1-8b-instant', 'google/gemini-2.5-flash', 'Génération de meta descriptions courtes et alt text d''images.');
