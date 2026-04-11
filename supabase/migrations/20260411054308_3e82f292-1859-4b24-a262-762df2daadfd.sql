
-- Create injection category enum
CREATE TYPE public.injection_category AS ENUM (
  'schema_jsonld',
  'meta_html',
  'root_files',
  'html_css_inline',
  'technical_attributes'
);

-- Create injection catalog table
CREATE TABLE public.injection_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category injection_category NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  template_code TEXT,
  required_data JSONB NOT NULL DEFAULT '{}',
  seo_impact TEXT NOT NULL DEFAULT 'medium' CHECK (seo_impact IN ('high', 'medium', 'low')),
  is_premium BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add suggested_injection_type to architect_workbench
ALTER TABLE public.architect_workbench
ADD COLUMN suggested_injection_type TEXT REFERENCES public.injection_catalog(slug);

-- Enable RLS
ALTER TABLE public.injection_catalog ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Authenticated users can read injection catalog"
ON public.injection_catalog FOR SELECT TO authenticated USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage injection catalog"
ON public.injection_catalog FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Timestamp trigger
CREATE TRIGGER update_injection_catalog_updated_at
BEFORE UPDATE ON public.injection_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for category filtering and search
CREATE INDEX idx_injection_catalog_category ON public.injection_catalog(category);
CREATE INDEX idx_injection_catalog_slug ON public.injection_catalog(slug);
CREATE INDEX idx_workbench_injection_type ON public.architect_workbench(suggested_injection_type);

-- ═══ SEED: Pre-populate catalog ═══

INSERT INTO public.injection_catalog (slug, category, label, description, seo_impact, is_premium, display_order, required_data) VALUES
-- Schema.org JSON-LD
('schema_localbusiness', 'schema_jsonld', 'LocalBusiness', 'Schema LocalBusiness avec sous-types (Restaurant, Store, Hotel…)', 'high', false, 10, '{"fields": ["name", "address", "phone", "openingHours", "geo"], "optional": ["priceRange", "aggregateRating"]}'),
('schema_faqpage', 'schema_jsonld', 'FAQPage', 'Section FAQ avec données structurées FAQPage', 'high', false, 11, '{"fields": ["questions"], "source": "workbench_keywords"}'),
('schema_howto', 'schema_jsonld', 'HowTo', 'Tutoriel pas-à-pas avec données structurées HowTo', 'medium', true, 12, '{"fields": ["name", "steps"], "optional": ["totalTime", "estimatedCost"]}'),
('schema_product', 'schema_jsonld', 'Product / Offer', 'Données produit avec prix, disponibilité, avis', 'high', true, 13, '{"fields": ["name", "price", "currency", "availability"], "optional": ["brand", "sku", "aggregateRating"]}'),
('schema_article', 'schema_jsonld', 'Article / BlogPosting', 'Données structurées Article pour contenu éditorial', 'medium', false, 14, '{"fields": ["headline", "author", "datePublished"], "optional": ["image", "publisher"]}'),
('schema_breadcrumb', 'schema_jsonld', 'BreadcrumbList', 'Fil d''Ariane avec données structurées', 'medium', false, 15, '{"fields": ["items"], "source": "page_hierarchy"}'),
('schema_organization', 'schema_jsonld', 'Organization / Brand', 'Identité d''entreprise avec logo, contacts, réseaux sociaux', 'medium', false, 16, '{"fields": ["name", "url", "logo"], "optional": ["sameAs", "contactPoint"]}'),
('schema_event', 'schema_jsonld', 'Event', 'Événement avec lieu, date, prix', 'medium', true, 17, '{"fields": ["name", "startDate", "location"], "optional": ["endDate", "offers", "performer"]}'),
('schema_review', 'schema_jsonld', 'Review / AggregateRating', 'Avis et notes agrégées', 'high', true, 18, '{"fields": ["ratingValue", "reviewCount"], "optional": ["bestRating", "author"]}'),
('schema_video', 'schema_jsonld', 'VideoObject', 'Données structurées pour vidéo embarquée', 'medium', true, 19, '{"fields": ["name", "thumbnailUrl", "uploadDate"], "optional": ["duration", "contentUrl"]}'),
('schema_service', 'schema_jsonld', 'Service', 'Description de prestation avec zone géographique', 'medium', true, 20, '{"fields": ["name", "provider", "areaServed"], "optional": ["offers", "description"]}'),
('schema_person', 'schema_jsonld', 'Person (E-E-A-T)', 'Auteur expert pour renforcer l''E-E-A-T', 'high', false, 21, '{"fields": ["name", "jobTitle"], "optional": ["sameAs", "image", "worksFor"]}'),
('schema_searchaction', 'schema_jsonld', 'SearchAction', 'Barre de recherche dans les SERP Google', 'low', false, 22, '{"fields": ["target_url_template"], "source": "site_url"}'),
('schema_sitenavigation', 'schema_jsonld', 'SiteNavigationElement', 'Navigation principale structurée', 'low', true, 23, '{"fields": ["name", "url"], "source": "site_navigation"}'),

-- Meta HTML
('meta_opengraph', 'meta_html', 'Open Graph', 'Balises og:title, og:description, og:image pour partage social', 'high', false, 30, '{"fields": ["og:title", "og:description", "og:image", "og:type"]}'),
('meta_twitter', 'meta_html', 'Twitter Cards', 'Balises twitter:card, twitter:title, twitter:image', 'medium', false, 31, '{"fields": ["twitter:card", "twitter:title", "twitter:image"]}'),
('meta_canonical', 'meta_html', 'Canonical URL', 'Balise <link rel="canonical"> pour éviter le contenu dupliqué', 'high', false, 32, '{"fields": ["canonical_url"]}'),
('meta_hreflang', 'meta_html', 'Hreflang', 'Balises hreflang pour sites multilingues', 'high', true, 33, '{"fields": ["language_urls"], "source": "site_languages"}'),
('meta_robots', 'meta_html', 'Robots / Googlebot', 'Directives meta robots (index, nofollow, max-snippet…)', 'medium', false, 34, '{"fields": ["directives"]}'),
('meta_preload', 'meta_html', 'Preload LCP', 'Préchargement des ressources critiques (LCP)', 'high', false, 35, '{"fields": ["resource_url", "resource_type"], "source": "pagespeed_lcp"}'),

-- Fichiers racine
('file_robots_txt', 'root_files', 'robots.txt', 'Règles de crawl pour moteurs + bots IA', 'high', false, 40, '{"fields": ["rules"], "source": "site_bots"}'),
('file_llms_txt', 'root_files', 'llms.txt / llms-full.txt', 'Manifeste pour LLMs (identité, services, FAQ)', 'high', true, 41, '{"fields": ["identity", "services", "faq"], "source": "identity_card"}'),
('file_sitemap', 'root_files', 'sitemap.xml', 'Plan du site XML pour indexation', 'high', false, 42, '{"fields": ["urls"], "source": "crawl_pages"}'),
('file_security_txt', 'root_files', 'security.txt', 'Contact sécurité (.well-known/security.txt)', 'low', false, 43, '{"fields": ["contact", "expires"]}'),
('file_ads_txt', 'root_files', 'ads.txt', 'Publicité programmatique autorisée', 'low', true, 44, '{"fields": ["entries"]}'),

-- HTML/CSS inline
('html_breadcrumb', 'html_css_inline', 'Fil d''Ariane HTML', 'Breadcrumb visible avec balisage accessible', 'medium', false, 50, '{"fields": ["items"], "source": "page_hierarchy"}'),
('html_info_section', 'html_css_inline', 'Section Informative GEO', 'Bloc contenu expert neutre pour visibilité GEO', 'high', true, 51, '{"fields": ["topic", "keywords"], "source": "workbench_keywords"}'),
('html_faq_section', 'html_css_inline', 'Section FAQ HTML', 'Bloc FAQ visible avec accordéon accessible', 'high', false, 52, '{"fields": ["questions"], "source": "workbench_keywords"}'),
('html_critical_css', 'html_css_inline', 'CSS Critique Inline', 'CSS above-the-fold injecté pour éliminer le render-blocking', 'high', false, 53, '{"fields": ["critical_css"], "source": "pagespeed_css"}'),
('html_anti_hallucination', 'html_css_inline', 'Calque Anti-Hallucination', 'Couche invisible (clip-path) clarifiant l''entité pour les LLMs', 'high', true, 54, '{"fields": ["entity_data"], "source": "identity_card"}'),

-- Attributs techniques
('attr_fetchpriority', 'technical_attributes', 'fetchpriority="high"', 'Attribut de priorité sur l''image LCP', 'high', false, 60, '{"fields": ["image_selector"], "source": "pagespeed_lcp"}'),
('attr_lazy_loading', 'technical_attributes', 'loading="lazy"', 'Chargement différé des images below-the-fold', 'medium', false, 61, '{"fields": ["image_selectors"], "source": "page_images"}'),
('attr_noopener', 'technical_attributes', 'rel="noopener noreferrer"', 'Sécurité sur les liens externes target=_blank', 'low', false, 62, '{"fields": ["link_selectors"], "source": "page_links"}'),
('attr_alt_images', 'technical_attributes', 'Alt manquants', 'Attributs alt descriptifs sur les images', 'high', false, 63, '{"fields": ["images"], "source": "audit_images_missing_alt"}'),
('attr_font_display', 'technical_attributes', 'font-display: swap', 'Affichage immédiat du texte pendant le chargement des fonts', 'medium', false, 64, '{"fields": ["font_urls"], "source": "pagespeed_fonts"}'),
('attr_image_dimensions', 'technical_attributes', 'width/height sur images', 'Dimensions explicites pour éviter le CLS', 'high', false, 65, '{"fields": ["image_selectors"], "source": "pagespeed_cls"}')
ON CONFLICT DO NOTHING;
