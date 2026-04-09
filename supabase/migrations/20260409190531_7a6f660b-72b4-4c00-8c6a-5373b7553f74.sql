-- Supprimer l'ancienne table
DROP TABLE IF EXISTS public.cro_variable_matrix;

-- Créer la table universelle
CREATE TABLE public.content_requirements_matrix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variable_key TEXT NOT NULL,
  variable_label TEXT NOT NULL,
  variable_description TEXT,
  page_type TEXT NOT NULL,
  search_intent TEXT NOT NULL DEFAULT 'all',
  consumer TEXT NOT NULL DEFAULT 'cro',
  is_required BOOLEAN NOT NULL DEFAULT false,
  weight INTEGER NOT NULL DEFAULT 50,
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(variable_key, page_type, search_intent, consumer)
);

CREATE INDEX idx_crm_consumer ON public.content_requirements_matrix(consumer);
CREATE INDEX idx_crm_page_intent ON public.content_requirements_matrix(page_type, search_intent);

ALTER TABLE public.content_requirements_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read requirements matrix"
  ON public.content_requirements_matrix FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage requirements matrix"
  ON public.content_requirements_matrix FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_content_requirements_matrix_updated_at
  BEFORE UPDATE ON public.content_requirements_matrix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA : Variables × Page Types × Intents × Consumers
-- intent 'all' = s'applique quelle que soit l'intention
-- ═══════════════════════════════════════════════════════════════

-- ── CONVERSION OPTIMIZER (cro) ──────────────────────────────
-- Social proof
INSERT INTO public.content_requirements_matrix (variable_key, variable_label, variable_description, page_type, search_intent, consumer, is_required, weight) VALUES
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'home', 'all', 'cro', true, 90),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'product', 'all', 'cro', true, 95),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'service', 'all', 'cro', true, 90),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'landing', 'commercial', 'cro', true, 95),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'landing', 'transactional', 'cro', true, 95),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'about', 'all', 'cro', true, 80),

-- Clear value proposition
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'home', 'all', 'cro', true, 95),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'product', 'all', 'cro', true, 90),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'service', 'all', 'cro', true, 95),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'landing', 'all', 'cro', true, 95),

-- Primary CTA
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'home', 'all', 'cro', true, 90),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'product', 'transactional', 'cro', true, 95),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'product', 'commercial', 'cro', true, 90),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'service', 'all', 'cro', true, 90),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'landing', 'all', 'cro', true, 95),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'blog_article', 'informational', 'cro', true, 70),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'contact', 'all', 'cro', true, 90),

-- Trust signals
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement', 'home', 'all', 'cro', true, 85),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement', 'product', 'transactional', 'cro', true, 95),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement', 'service', 'commercial', 'cro', true, 90),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement', 'landing', 'transactional', 'cro', true, 95),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement', 'contact', 'all', 'cro', true, 80),

-- Pricing visible
('pricing_visible', 'Tarification visible', 'Prix ou fourchette affichés clairement', 'product', 'transactional', 'cro', true, 90),
('pricing_visible', 'Tarification visible', 'Prix ou fourchette affichés clairement', 'product', 'commercial', 'cro', true, 85),
('pricing_visible', 'Tarification visible', 'Prix ou fourchette affichés clairement', 'category', 'commercial', 'cro', true, 80),

-- FAQ
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'product', 'commercial', 'cro', true, 80),
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'service', 'commercial', 'cro', true, 85),
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'landing', 'commercial', 'cro', true, 85),

-- Contact form
('contact_form', 'Formulaire de contact', 'Moyen de contact direct visible', 'service', 'commercial', 'cro', true, 85),
('contact_form', 'Formulaire de contact', 'Moyen de contact direct visible', 'landing', 'transactional', 'cro', true, 90),
('contact_form', 'Formulaire de contact', 'Moyen de contact direct visible', 'contact', 'all', 'cro', true, 95),

-- Urgency/scarcity
('urgency_scarcity', 'Urgence / rareté', 'Offre limitée, countdown, stock', 'product', 'transactional', 'cro', true, 75),
('urgency_scarcity', 'Urgence / rareté', 'Offre limitée, countdown, stock', 'landing', 'transactional', 'cro', true, 80),

-- Hero image
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel', 'home', 'all', 'cro', true, 85),
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel', 'product', 'all', 'cro', true, 90),
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel', 'service', 'all', 'cro', true, 85),
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel', 'landing', 'all', 'cro', true, 90),

-- Testimonials
('testimonials', 'Témoignages clients', 'Citations, vidéos de clients satisfaits', 'home', 'all', 'cro', true, 85),
('testimonials', 'Témoignages clients', 'Citations, vidéos de clients satisfaits', 'service', 'commercial', 'cro', true, 90),
('testimonials', 'Témoignages clients', 'Citations, vidéos de clients satisfaits', 'landing', 'commercial', 'cro', true, 90),

-- Case studies
('case_studies', 'Études de cas', 'Résultats concrets obtenus pour des clients', 'service', 'commercial', 'cro', true, 80),
('case_studies', 'Études de cas', 'Résultats concrets obtenus pour des clients', 'about', 'all', 'cro', true, 70),

-- Lead magnet
('lead_magnet', 'Lead magnet', 'Contenu gratuit en échange d''un email', 'landing', 'informational', 'cro', true, 85),
('lead_magnet', 'Lead magnet', 'Contenu gratuit en échange d''un email', 'blog_article', 'informational', 'cro', true, 80),

-- ── CONTENT ARCHITECT (content_architect) ───────────────────
-- What to include when creating/editing pages

('clear_value_prop', 'Proposition de valeur claire', 'Message principal en H1/premier paragraphe', 'home', 'all', 'content_architect', true, 95),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal en H1/premier paragraphe', 'product', 'all', 'content_architect', true, 90),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal en H1/premier paragraphe', 'service', 'all', 'content_architect', true, 95),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal en H1/premier paragraphe', 'landing', 'all', 'content_architect', true, 95),

('structured_data', 'Données structurées', 'JSON-LD approprié au type de page (Product, Service, FAQPage, Article)', 'product', 'all', 'content_architect', true, 85),
('structured_data', 'Données structurées', 'JSON-LD approprié au type de page', 'service', 'all', 'content_architect', true, 85),
('structured_data', 'Données structurées', 'JSON-LD approprié au type de page', 'blog_article', 'all', 'content_architect', true, 80),
('structured_data', 'Données structurées', 'JSON-LD approprié au type de page', 'landing', 'all', 'content_architect', true, 80),

('internal_links', 'Maillage interne', 'Liens contextuels vers pages liées du même silo', 'blog_article', 'informational', 'content_architect', true, 85),
('internal_links', 'Maillage interne', 'Liens contextuels vers pages liées du même silo', 'product', 'all', 'content_architect', true, 80),
('internal_links', 'Maillage interne', 'Liens contextuels vers pages liées du même silo', 'service', 'all', 'content_architect', true, 80),
('internal_links', 'Maillage interne', 'Liens contextuels vers pages liées du même silo', 'category', 'all', 'content_architect', true, 90),

('faq_section', 'Section FAQ', 'Questions fréquentes avec balisage FAQPage', 'product', 'commercial', 'content_architect', true, 85),
('faq_section', 'Section FAQ', 'Questions fréquentes avec balisage FAQPage', 'service', 'commercial', 'content_architect', true, 85),
('faq_section', 'Section FAQ', 'Questions fréquentes avec balisage FAQPage', 'landing', 'informational', 'content_architect', true, 80),

('meta_description', 'Meta description optimisée', 'Meta description avec mot-clé principal et CTA implicite', 'home', 'all', 'content_architect', true, 85),
('meta_description', 'Meta description optimisée', 'Meta description avec mot-clé principal et CTA implicite', 'product', 'all', 'content_architect', true, 85),
('meta_description', 'Meta description optimisée', 'Meta description avec mot-clé principal et CTA implicite', 'service', 'all', 'content_architect', true, 85),
('meta_description', 'Meta description optimisée', 'Meta description avec mot-clé principal et CTA implicite', 'blog_article', 'all', 'content_architect', true, 85),
('meta_description', 'Meta description optimisée', 'Meta description avec mot-clé principal et CTA implicite', 'landing', 'all', 'content_architect', true, 85),

('table_of_contents', 'Sommaire / Table des matières', 'Navigation intra-page pour le contenu long', 'blog_article', 'informational', 'content_architect', true, 75),

('primary_cta', 'CTA principal', 'Appel à l''action adapté à l''intention de la page', 'blog_article', 'informational', 'content_architect', true, 70),
('primary_cta', 'CTA principal', 'Appel à l''action adapté à l''intention de la page', 'landing', 'transactional', 'content_architect', true, 95),

-- ── EEAT AUDIT (eeat) ───────────────────────────────────────
-- Signals to verify for E-E-A-T compliance

('author_bio', 'Biographie auteur', 'Identité, expertise et credentials de l''auteur visible', 'blog_article', 'all', 'eeat', true, 90),
('author_bio', 'Biographie auteur', 'Identité, expertise et credentials de l''auteur visible', 'about', 'all', 'eeat', true, 85),

('publication_date', 'Date de publication', 'Date de publication/mise à jour visible', 'blog_article', 'all', 'eeat', true, 85),

('sources_citations', 'Sources et citations', 'Liens vers sources fiables, études, données', 'blog_article', 'informational', 'eeat', true, 85),

('expertise_signals', 'Signaux d''expertise', 'Certifications, années d''expérience, diplômes, publications', 'service', 'all', 'eeat', true, 85),
('expertise_signals', 'Signaux d''expertise', 'Certifications, années d''expérience, diplômes, publications', 'about', 'all', 'eeat', true, 90),
('expertise_signals', 'Signaux d''expertise', 'Certifications, années d''expérience, diplômes, publications', 'home', 'all', 'eeat', true, 75),

('trust_signals', 'Signaux de confiance', 'Mentions légales, politique de confidentialité, CGV accessibles', 'home', 'all', 'eeat', true, 80),
('trust_signals', 'Signaux de confiance', 'Mentions légales, politique de confidentialité, CGV accessibles', 'product', 'transactional', 'eeat', true, 90),

('social_proof', 'Preuves sociales', 'Avis vérifiés, témoignages avec identité', 'product', 'all', 'eeat', true, 85),
('social_proof', 'Preuves sociales', 'Avis vérifiés, témoignages avec identité', 'service', 'all', 'eeat', true, 85),

('contact_info', 'Informations de contact', 'Adresse, téléphone, email vérifiables', 'home', 'all', 'eeat', true, 80),
('contact_info', 'Informations de contact', 'Adresse, téléphone, email vérifiables', 'about', 'all', 'eeat', true, 85),
('contact_info', 'Informations de contact', 'Adresse, téléphone, email vérifiables', 'contact', 'all', 'eeat', true, 95),

('about_page_link', 'Lien vers page À propos', 'Lien facilement accessible vers la page institutionnelle', 'home', 'all', 'eeat', true, 70),
('about_page_link', 'Lien vers page À propos', 'Lien facilement accessible vers la page institutionnelle', 'blog_article', 'all', 'eeat', true, 70),

-- ── GEO STRATEGIC (geo_strategic) ───────────────────────────
-- Elements important for GEO/LLM visibility

('entity_definition', 'Définition d''entité claire', 'Phrase(s) définitoire(s) identifiant clairement l''entité et son domaine d''expertise', 'home', 'all', 'geo_strategic', true, 90),
('entity_definition', 'Définition d''entité claire', 'Phrase(s) définitoire(s) identifiant clairement l''entité', 'about', 'all', 'geo_strategic', true, 95),

('structured_data', 'Données structurées riches', 'JSON-LD Organization/Person avec sameAs, knowsAbout', 'home', 'all', 'geo_strategic', true, 90),
('structured_data', 'Données structurées riches', 'JSON-LD avec contexte sémantique étendu', 'about', 'all', 'geo_strategic', true, 90),
('structured_data', 'Données structurées riches', 'JSON-LD Article avec author, datePublished', 'blog_article', 'all', 'geo_strategic', true, 85),

('citability_signals', 'Signaux de citabilité', 'Données uniques, statistiques originales, méthodologie propriétaire', 'blog_article', 'informational', 'geo_strategic', true, 85),
('citability_signals', 'Signaux de citabilité', 'Données uniques, statistiques originales', 'landing', 'informational', 'geo_strategic', true, 80),

('topical_depth', 'Profondeur thématique', 'Couverture exhaustive du sujet avec sous-thèmes structurés en H2/H3', 'blog_article', 'informational', 'geo_strategic', true, 90),
('topical_depth', 'Profondeur thématique', 'Couverture exhaustive du sujet', 'service', 'informational', 'geo_strategic', true, 80),

('competitor_differentiation', 'Différenciation concurrentielle', 'Points de distinction clairs par rapport aux concurrents', 'home', 'commercial', 'geo_strategic', true, 80),
('competitor_differentiation', 'Différenciation concurrentielle', 'Points de distinction clairs', 'service', 'commercial', 'geo_strategic', true, 85),
('competitor_differentiation', 'Différenciation concurrentielle', 'Points de distinction clairs', 'product', 'commercial', 'geo_strategic', true, 85),

('geo_local_signals', 'Signaux de localisation', 'Adresse, zone de chalandise, données LocalBusiness', 'home', 'navigational', 'geo_strategic', true, 85),
('geo_local_signals', 'Signaux de localisation', 'Adresse, zone de chalandise', 'contact', 'all', 'geo_strategic', true, 90),
('geo_local_signals', 'Signaux de localisation', 'Adresse, zone de chalandise', 'service', 'navigational', 'geo_strategic', true, 80);
