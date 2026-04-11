
-- Create a function that auto-suggests injection type based on finding category and content
CREATE OR REPLACE FUNCTION public.suggest_injection_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only auto-suggest if not already set
  IF NEW.suggested_injection_type IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.suggested_injection_type := CASE
    -- Structured data findings
    WHEN NEW.finding_category = 'structured_data' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%local%' OR LOWER(COALESCE(NEW.description, '')) LIKE '%localbusiness%'
    ) THEN 'schema_localbusiness'
    WHEN NEW.finding_category = 'structured_data' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%faq%' OR LOWER(COALESCE(NEW.description, '')) LIKE '%faq%'
    ) THEN 'schema_faqpage'
    WHEN NEW.finding_category = 'structured_data' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%product%' OR LOWER(COALESCE(NEW.description, '')) LIKE '%produit%'
    ) THEN 'schema_product'
    WHEN NEW.finding_category = 'structured_data' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%article%' OR LOWER(COALESCE(NEW.description, '')) LIKE '%blog%'
    ) THEN 'schema_article'
    WHEN NEW.finding_category = 'structured_data' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%breadcrumb%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%ariane%'
    ) THEN 'schema_breadcrumb'
    WHEN NEW.finding_category = 'structured_data' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%organization%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%entreprise%'
    ) THEN 'schema_organization'
    WHEN NEW.finding_category = 'structured_data' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%event%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%événement%'
    ) THEN 'schema_event'
    WHEN NEW.finding_category = 'structured_data' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%video%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%vidéo%'
    ) THEN 'schema_video'
    WHEN NEW.finding_category = 'structured_data' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%person%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%auteur%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%e-e-a-t%'
    ) THEN 'schema_person'
    WHEN NEW.finding_category = 'structured_data' THEN 'schema_organization'

    -- Meta tags
    WHEN NEW.finding_category = 'meta_tags' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%open graph%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%og:%'
    ) THEN 'meta_opengraph'
    WHEN NEW.finding_category = 'meta_tags' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%twitter%'
    ) THEN 'meta_twitter'
    WHEN NEW.finding_category = 'meta_tags' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%robot%'
    ) THEN 'meta_robots'
    WHEN NEW.finding_category = 'meta_tags' THEN 'meta_opengraph'

    -- Canonical
    WHEN NEW.finding_category = 'canonical' THEN 'meta_canonical'

    -- Robots / crawl
    WHEN NEW.finding_category = 'robots' THEN 'file_robots_txt'
    WHEN NEW.finding_category = 'sitemap' THEN 'file_sitemap'

    -- Speed / Core Web Vitals
    WHEN NEW.finding_category IN ('speed', 'core_web_vitals') AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%lcp%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%image%'
    ) THEN 'attr_fetchpriority'
    WHEN NEW.finding_category IN ('speed', 'core_web_vitals') AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%cls%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%dimension%'
    ) THEN 'attr_image_dimensions'
    WHEN NEW.finding_category IN ('speed', 'core_web_vitals') AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%font%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%police%'
    ) THEN 'attr_font_display'
    WHEN NEW.finding_category IN ('speed', 'core_web_vitals') AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%css%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%render%'
    ) THEN 'html_critical_css'
    WHEN NEW.finding_category IN ('speed', 'core_web_vitals') THEN 'meta_preload'

    -- Content gaps → info sections or FAQ
    WHEN NEW.finding_category IN ('content_gap', 'missing_content', 'thin_content') THEN 'html_info_section'
    WHEN NEW.finding_category = 'content_upgrade' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%faq%'
    ) THEN 'html_faq_section'

    -- E-E-A-T
    WHEN NEW.finding_category = 'eeat' THEN 'schema_person'

    -- GEO visibility
    WHEN NEW.finding_category = 'geo_visibility' THEN 'html_anti_hallucination'

    -- Linking / navigation
    WHEN NEW.finding_category IN ('linking', 'silo_structure') AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%ariane%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%breadcrumb%'
    ) THEN 'html_breadcrumb'

    -- Security (external links)
    WHEN NEW.finding_category = 'security' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%noopener%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%target%'
    ) THEN 'attr_noopener'

    -- Accessibility (images)
    WHEN NEW.finding_category = 'accessibility' AND (
      LOWER(COALESCE(NEW.title, '')) LIKE '%alt%' OR LOWER(COALESCE(NEW.title, '')) LIKE '%image%'
    ) THEN 'attr_alt_images'

    ELSE NULL
  END;

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER auto_suggest_injection_type
BEFORE INSERT OR UPDATE ON public.architect_workbench
FOR EACH ROW
EXECUTE FUNCTION public.suggest_injection_type();

-- Backfill existing workbench items
UPDATE public.architect_workbench SET suggested_injection_type = CASE
  WHEN finding_category = 'structured_data' AND LOWER(COALESCE(title, '')) LIKE '%local%' THEN 'schema_localbusiness'
  WHEN finding_category = 'structured_data' AND LOWER(COALESCE(title, '')) LIKE '%faq%' THEN 'schema_faqpage'
  WHEN finding_category = 'structured_data' AND LOWER(COALESCE(title, '')) LIKE '%breadcrumb%' THEN 'schema_breadcrumb'
  WHEN finding_category = 'structured_data' THEN 'schema_organization'
  WHEN finding_category = 'meta_tags' THEN 'meta_opengraph'
  WHEN finding_category = 'canonical' THEN 'meta_canonical'
  WHEN finding_category = 'robots' THEN 'file_robots_txt'
  WHEN finding_category = 'sitemap' THEN 'file_sitemap'
  WHEN finding_category IN ('speed', 'core_web_vitals') THEN 'meta_preload'
  WHEN finding_category IN ('content_gap', 'missing_content') THEN 'html_info_section'
  WHEN finding_category = 'eeat' THEN 'schema_person'
  WHEN finding_category = 'geo_visibility' THEN 'html_anti_hallucination'
  ELSE NULL
END
WHERE suggested_injection_type IS NULL AND status IN ('pending', 'assigned', 'in_progress');
