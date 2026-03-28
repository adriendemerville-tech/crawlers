
-- Type de page pour les prompts de contenu
CREATE TYPE public.content_page_type AS ENUM ('landing', 'product', 'article');

-- Table des prompts-templates par type de page
CREATE TABLE public.content_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type content_page_type NOT NULL UNIQUE,
  label TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  structure_template TEXT NOT NULL,
  seo_rules TEXT NOT NULL,
  geo_rules TEXT NOT NULL,
  tone_guidelines TEXT NOT NULL,
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  detection_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_prompt_templates ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire/modifier
CREATE POLICY "Admins can manage prompt templates"
  ON public.content_prompt_templates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role (edge functions) peut lire
CREATE POLICY "Service role can read prompt templates"
  ON public.content_prompt_templates
  FOR SELECT
  TO service_role
  USING (true);
