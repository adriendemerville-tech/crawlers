-- Felix self-configuration table
CREATE TABLE public.felix_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.felix_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage felix_config"
  ON public.felix_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_felix_config_updated_at
  BEFORE UPDATE ON public.felix_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default values
INSERT INTO public.felix_config (config_key, config_value, description) VALUES
  ('tone', 'collegial', 'Ton des réponses : collegial, formel, decontracte, technique'),
  ('max_tokens', '600', 'Limite de caractères par réponse par défaut'),
  ('max_tokens_creator', '2000', 'Limite de caractères pour le creator'),
  ('vouvoiement', 'auto', 'auto = miroir de l''utilisateur, toujours = vouvoie, jamais = tutoie'),
  ('emojis', 'mirror', 'mirror = idem utilisateur, always = toujours, never = jamais'),
  ('cta_style', 'subtle', 'Style des CTAs : subtle, direct, none'),
  ('greeting_style', 'skip', 'skip = pas de formule de politesse, warm = salutation légère'),
  ('user_level_detection', 'true', 'Adapte le niveau technique au profil détecté'),
  ('proactive_suggestions', 'true', 'Propositions opérationnelles proactives'),
  ('model', 'google/gemini-2.5-flash', 'Modèle LLM utilisé par Félix'),
  ('confidentiality_strict', 'true', 'Ne révèle jamais l''architecture interne');
