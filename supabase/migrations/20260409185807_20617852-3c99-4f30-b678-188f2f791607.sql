-- Table de référence CRO : variables × types de pages
CREATE TABLE public.cro_variable_matrix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variable_key TEXT NOT NULL,
  variable_label TEXT NOT NULL,
  variable_description TEXT,
  page_type TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(variable_key, page_type)
);

ALTER TABLE public.cro_variable_matrix ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les authentifiés
CREATE POLICY "Authenticated users can read CRO matrix"
  ON public.cro_variable_matrix FOR SELECT
  TO authenticated USING (true);

-- Écriture réservée aux admins
CREATE POLICY "Admins can manage CRO matrix"
  ON public.cro_variable_matrix FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER update_cro_variable_matrix_updated_at
  BEFORE UPDATE ON public.cro_variable_matrix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ Pré-remplissage ═══
-- Variables CRO:
-- social_proof, clear_value_prop, primary_cta, trust_signals, pricing_visible,
-- faq_section, contact_form, urgency_scarcity, hero_image, testimonials,
-- case_studies, lead_magnet

-- Page types:
-- home, product, service, landing, blog_article, category, about, contact

INSERT INTO public.cro_variable_matrix (variable_key, variable_label, variable_description, page_type, is_required, source) VALUES
-- social_proof
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'home', true, 'system'),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'product', true, 'system'),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'service', true, 'system'),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'landing', true, 'system'),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'blog_article', false, 'system'),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'category', false, 'system'),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'about', true, 'system'),
('social_proof', 'Preuves sociales', 'Avis clients, notes, logos partenaires, nombre de clients', 'contact', false, 'system'),

-- clear_value_prop
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'home', true, 'system'),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'product', true, 'system'),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'service', true, 'system'),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'landing', true, 'system'),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'blog_article', false, 'system'),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'category', false, 'system'),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'about', true, 'system'),
('clear_value_prop', 'Proposition de valeur claire', 'Message principal visible en above-the-fold', 'contact', false, 'system'),

-- primary_cta
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'home', true, 'system'),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'product', true, 'system'),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'service', true, 'system'),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'landing', true, 'system'),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'blog_article', true, 'system'),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'category', false, 'system'),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'about', false, 'system'),
('primary_cta', 'CTA principal', 'Bouton d''action principal visible et explicite', 'contact', true, 'system'),

-- trust_signals
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement, mentions légales', 'home', true, 'system'),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement, mentions légales', 'product', true, 'system'),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement, mentions légales', 'service', true, 'system'),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement, mentions légales', 'landing', true, 'system'),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement, mentions légales', 'blog_article', false, 'system'),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement, mentions légales', 'category', false, 'system'),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement, mentions légales', 'about', true, 'system'),
('trust_signals', 'Signaux de confiance', 'Certifications, garanties, sécurité paiement, mentions légales', 'contact', true, 'system'),

-- pricing_visible
('pricing_visible', 'Tarification visible', 'Prix ou fourchette de prix affichés clairement', 'home', false, 'system'),
('pricing_visible', 'Tarification visible', 'Prix ou fourchette de prix affichés clairement', 'product', true, 'system'),
('pricing_visible', 'Tarification visible', 'Prix ou fourchette de prix affichés clairement', 'service', false, 'system'),
('pricing_visible', 'Tarification visible', 'Prix ou fourchette de prix affichés clairement', 'landing', false, 'system'),
('pricing_visible', 'Tarification visible', 'Prix ou fourchette de prix affichés clairement', 'blog_article', false, 'system'),
('pricing_visible', 'Tarification visible', 'Prix ou fourchette de prix affichés clairement', 'category', true, 'system'),
('pricing_visible', 'Tarification visible', 'Prix ou fourchette de prix affichés clairement', 'about', false, 'system'),
('pricing_visible', 'Tarification visible', 'Prix ou fourchette de prix affichés clairement', 'contact', false, 'system'),

-- faq_section
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'home', false, 'system'),
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'product', true, 'system'),
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'service', true, 'system'),
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'landing', true, 'system'),
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'blog_article', false, 'system'),
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'category', false, 'system'),
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'about', false, 'system'),
('faq_section', 'Section FAQ', 'Questions fréquentes pour lever les objections', 'contact', false, 'system'),

-- contact_form
('contact_form', 'Formulaire de contact', 'Formulaire ou moyen de contact direct visible', 'home', false, 'system'),
('contact_form', 'Formulaire de contact', 'Formulaire ou moyen de contact direct visible', 'product', false, 'system'),
('contact_form', 'Formulaire de contact', 'Formulaire ou moyen de contact direct visible', 'service', true, 'system'),
('contact_form', 'Formulaire de contact', 'Formulaire ou moyen de contact direct visible', 'landing', true, 'system'),
('contact_form', 'Formulaire de contact', 'Formulaire ou moyen de contact direct visible', 'blog_article', false, 'system'),
('contact_form', 'Formulaire de contact', 'Formulaire ou moyen de contact direct visible', 'category', false, 'system'),
('contact_form', 'Formulaire de contact', 'Formulaire ou moyen de contact direct visible', 'about', false, 'system'),
('contact_form', 'Formulaire de contact', 'Formulaire ou moyen de contact direct visible', 'contact', true, 'system'),

-- urgency_scarcity
('urgency_scarcity', 'Urgence / rareté', 'Éléments de rareté, offre limitée, countdown', 'home', false, 'system'),
('urgency_scarcity', 'Urgence / rareté', 'Éléments de rareté, offre limitée, countdown', 'product', true, 'system'),
('urgency_scarcity', 'Urgence / rareté', 'Éléments de rareté, offre limitée, countdown', 'landing', true, 'system'),
('urgency_scarcity', 'Urgence / rareté', 'Éléments de rareté, offre limitée, countdown', 'blog_article', false, 'system'),
('urgency_scarcity', 'Urgence / rareté', 'Éléments de rareté, offre limitée, countdown', 'service', false, 'system'),
('urgency_scarcity', 'Urgence / rareté', 'Éléments de rareté, offre limitée, countdown', 'category', false, 'system'),
('urgency_scarcity', 'Urgence / rareté', 'Éléments de rareté, offre limitée, countdown', 'about', false, 'system'),
('urgency_scarcity', 'Urgence / rareté', 'Éléments de rareté, offre limitée, countdown', 'contact', false, 'system'),

-- hero_image
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel en haut de page', 'home', true, 'system'),
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel en haut de page', 'product', true, 'system'),
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel en haut de page', 'service', true, 'system'),
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel en haut de page', 'landing', true, 'system'),
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel en haut de page', 'blog_article', true, 'system'),
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel en haut de page', 'category', false, 'system'),
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel en haut de page', 'about', true, 'system'),
('hero_image', 'Image hero convaincante', 'Visuel principal pertinent et professionnel en haut de page', 'contact', false, 'system'),

-- testimonials
('testimonials', 'Témoignages clients', 'Citations, vidéos ou études de cas de clients satisfaits', 'home', true, 'system'),
('testimonials', 'Témoignages clients', 'Citations, vidéos ou études de cas de clients satisfaits', 'product', true, 'system'),
('testimonials', 'Témoignages clients', 'Citations, vidéos ou études de cas de clients satisfaits', 'service', true, 'system'),
('testimonials', 'Témoignages clients', 'Citations, vidéos ou études de cas de clients satisfaits', 'landing', true, 'system'),
('testimonials', 'Témoignages clients', 'Citations, vidéos ou études de cas de clients satisfaits', 'blog_article', false, 'system'),
('testimonials', 'Témoignages clients', 'Citations, vidéos ou études de cas de clients satisfaits', 'category', false, 'system'),
('testimonials', 'Témoignages clients', 'Citations, vidéos ou études de cas de clients satisfaits', 'about', true, 'system'),
('testimonials', 'Témoignages clients', 'Citations, vidéos ou études de cas de clients satisfaits', 'contact', false, 'system'),

-- case_studies
('case_studies', 'Études de cas', 'Exemples concrets de résultats obtenus pour des clients', 'home', false, 'system'),
('case_studies', 'Études de cas', 'Exemples concrets de résultats obtenus pour des clients', 'product', false, 'system'),
('case_studies', 'Études de cas', 'Exemples concrets de résultats obtenus pour des clients', 'service', true, 'system'),
('case_studies', 'Études de cas', 'Exemples concrets de résultats obtenus pour des clients', 'landing', false, 'system'),
('case_studies', 'Études de cas', 'Exemples concrets de résultats obtenus pour des clients', 'blog_article', false, 'system'),
('case_studies', 'Études de cas', 'Exemples concrets de résultats obtenus pour des clients', 'category', false, 'system'),
('case_studies', 'Études de cas', 'Exemples concrets de résultats obtenus pour des clients', 'about', true, 'system'),
('case_studies', 'Études de cas', 'Exemples concrets de résultats obtenus pour des clients', 'contact', false, 'system'),

-- lead_magnet
('lead_magnet', 'Lead magnet', 'Contenu gratuit en échange d''un email (ebook, checklist, outil)', 'home', false, 'system'),
('lead_magnet', 'Lead magnet', 'Contenu gratuit en échange d''un email (ebook, checklist, outil)', 'product', false, 'system'),
('lead_magnet', 'Lead magnet', 'Contenu gratuit en échange d''un email (ebook, checklist, outil)', 'service', false, 'system'),
('lead_magnet', 'Lead magnet', 'Contenu gratuit en échange d''un email (ebook, checklist, outil)', 'landing', true, 'system'),
('lead_magnet', 'Lead magnet', 'Contenu gratuit en échange d''un email (ebook, checklist, outil)', 'blog_article', true, 'system'),
('lead_magnet', 'Lead magnet', 'Contenu gratuit en échange d''un email (ebook, checklist, outil)', 'category', false, 'system'),
('lead_magnet', 'Lead magnet', 'Contenu gratuit en échange d''un email (ebook, checklist, outil)', 'about', false, 'system'),
('lead_magnet', 'Lead magnet', 'Contenu gratuit en échange d''un email (ebook, checklist, outil)', 'contact', false, 'system');
