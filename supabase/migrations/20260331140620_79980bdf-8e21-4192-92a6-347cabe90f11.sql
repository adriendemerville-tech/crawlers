
-- Table to store E-E-A-T scoring criteria/parameters (admin-managed)
CREATE TABLE public.eeat_scoring_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('experience', 'expertise', 'authoritativeness', 'trustworthiness')),
  scoring_method TEXT NOT NULL DEFAULT 'telemetry' CHECK (scoring_method IN ('telemetry', 'heuristic', 'llm')),
  weight NUMERIC NOT NULL DEFAULT 1.0,
  max_score INTEGER NOT NULL DEFAULT 100,
  detection_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.eeat_scoring_criteria ENABLE ROW LEVEL SECURITY;

-- Only admins can manage criteria
CREATE POLICY "Admins can manage eeat_scoring_criteria"
ON public.eeat_scoring_criteria
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public read for active criteria (used by scan functions)
CREATE POLICY "Anyone can read active eeat criteria"
ON public.eeat_scoring_criteria
FOR SELECT
TO authenticated
USING (is_active = true);

-- Auto-update updated_at
CREATE TRIGGER update_eeat_scoring_criteria_updated_at
  BEFORE UPDATE ON public.eeat_scoring_criteria
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed the 14 hybrid criteria
INSERT INTO public.eeat_scoring_criteria (criterion_key, label, category, scoring_method, weight, description, detection_config, display_order) VALUES
('experience_testimony', 'Témoignage d''expérience', 'experience', 'telemetry', 1.0, 'Détection de patterns : "j''ai testé", "notre expérience", études de cas', '{"patterns": ["j''ai testé", "notre expérience", "nous avons", "étude de cas", "retour d''expérience", "en pratique"]}', 1),
('visual_proof', 'Preuves visuelles', 'experience', 'telemetry', 0.8, 'Comptage images/vidéos originales, screenshots, infographies', '{"formula": "media_count * 10, cap 100"}', 2),
('author_identified', 'Auteur identifié', 'expertise', 'telemetry', 1.2, 'Détection byline, Schema Person, meta author', '{"selectors": ["[rel=author]", "meta[name=author]", "schema:Person"]}', 3),
('bio_credentials', 'Bio & Credentials', 'expertise', 'telemetry', 1.0, 'Section bio, liens LinkedIn, Schema Person.jobTitle', '{"scoring": "0/50/100 (absent/partiel/complet)"}', 4),
('content_depth', 'Profondeur de contenu', 'expertise', 'heuristic', 1.0, 'word_count, ratio H2-H3/mots, listes structurées', '{"formula": "min(100, word_count/20 + heading_ratio * 50)"}', 5),
('citations_sources', 'Citations & Sources', 'authoritativeness', 'telemetry', 1.2, 'Comptage liens sortants vers .edu, .gov, sources autoritaires', '{"formula": "quality_links * 15, cap 100", "authority_domains": [".edu", ".gov", ".gouv"]}', 6),
('structured_data', 'Données structurées', 'authoritativeness', 'telemetry', 0.8, 'Présence Schema.org pertinent (Article, FAQPage, HowTo, Product)', '{"types": ["Article", "FAQPage", "HowTo", "Product", "Organization"]}', 7),
('freshness', 'Fraîcheur du contenu', 'authoritativeness', 'telemetry', 0.8, 'datePublished, dateModified via Schema ou <time>', '{"decay": "exponential from publication date"}', 8),
('trust_pages', 'Pages de confiance', 'trustworthiness', 'telemetry', 1.0, 'Détection /mentions-legales, /cgv, /privacy, /a-propos', '{"paths": ["/mentions-legales", "/cgv", "/privacy", "/a-propos", "/contact"]}', 9),
('https_security', 'HTTPS & Sécurité', 'trustworthiness', 'telemetry', 0.6, 'Protocole HTTPS, headers sécurité', '{"checks": ["https", "hsts", "x-frame-options"]}', 10),
('content_originality', 'Originalité du contenu', 'trustworthiness', 'llm', 1.2, 'Évaluation par LLM de l''originalité vs contenu générique', '{"prompt_key": "originality"}', 11),
('intent_relevance', 'Pertinence vs Intention', 'expertise', 'llm', 1.0, 'Alignement title/H1 + keywords GSC. LLM si pas de data GSC', '{"fallback": "llm_if_no_gsc"}', 12),
('writing_quality', 'Qualité rédactionnelle', 'expertise', 'llm', 0.8, 'Clarté, structure, engagement — évalué par LLM', '{"prompt_key": "writing_quality"}', 13),
('brand_self_citation', 'Auto-citations de marque', 'authoritativeness', 'telemetry', 0.6, 'Détection du nom de marque dans le body', '{"formula": "occurrences count, cap 100"}', 14);
