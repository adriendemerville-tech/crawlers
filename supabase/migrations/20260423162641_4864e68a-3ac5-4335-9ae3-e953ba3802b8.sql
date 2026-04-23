
-- CMS page content: allows Parmenion to modify H1/H2/texts of marketing pages via DB
CREATE TABLE public.cms_page_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL DEFAULT 'fr',
  content JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(page_key, locale)
);

COMMENT ON TABLE public.cms_page_content IS 'Dynamic marketing page content editable by Parmenion without redeploy';
COMMENT ON COLUMN public.cms_page_content.page_key IS 'Page identifier e.g. home, tarifs, features, about';
COMMENT ON COLUMN public.cms_page_content.content IS 'JSON with keys like h1, h2, subtitle, description, cta_text';
COMMENT ON COLUMN public.cms_page_content.updated_by IS 'Who last modified: manual, parmenion, agent-seo';

ALTER TABLE public.cms_page_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public marketing pages)
CREATE POLICY "Public read access to page content"
  ON public.cms_page_content FOR SELECT
  USING (true);

-- Only admins can modify (via edge functions with service role)
CREATE POLICY "Service role can manage page content"
  ON public.cms_page_content FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_cms_page_content_updated_at
  BEFORE UPDATE ON public.cms_page_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
