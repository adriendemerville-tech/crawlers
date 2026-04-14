
-- =============================================
-- Table sitemap_entries
-- =============================================
CREATE TABLE public.sitemap_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL DEFAULT 'crawlers.fr',
  loc TEXT NOT NULL,
  lastmod DATE NOT NULL DEFAULT CURRENT_DATE,
  changefreq TEXT DEFAULT 'weekly',
  priority NUMERIC(2,1) DEFAULT 0.5,
  page_type TEXT DEFAULT 'static',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain, loc)
);

-- Index for sitemap generation queries
CREATE INDEX idx_sitemap_entries_domain_active ON public.sitemap_entries (domain, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.sitemap_entries ENABLE ROW LEVEL SECURITY;

-- Public read (edge function uses service_role, but allow public read too)
CREATE POLICY "Sitemap entries are publicly readable"
  ON public.sitemap_entries FOR SELECT
  USING (true);

-- Only service_role can insert/update/delete (via edge functions)
CREATE POLICY "Service role can manage sitemap entries"
  ON public.sitemap_entries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_sitemap_entries_updated_at
  BEFORE UPDATE ON public.sitemap_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Seed: Static pages (lastmod = date de déploiement initial)
-- =============================================
INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, page_type) VALUES
  -- Homepage
  ('crawlers.fr', 'https://crawlers.fr', '2025-06-01', 'daily', 1.0, 'static'),
  -- Outils principaux
  ('crawlers.fr', 'https://crawlers.fr/audit-expert', '2025-06-01', 'weekly', 0.9, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/audit-compare', '2025-06-01', 'weekly', 0.8, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/site-crawl', '2025-06-01', 'weekly', 0.8, 'static'),
  -- Pages produit & info
  ('crawlers.fr', 'https://crawlers.fr/lexique', '2025-06-01', 'monthly', 0.6, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/tarifs', '2025-06-01', 'monthly', 0.8, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/pro-agency', '2025-06-01', 'monthly', 0.7, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/observatoire', '2025-06-01', 'weekly', 0.7, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/faq', '2025-06-01', 'monthly', 0.5, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/methodologie', '2025-06-01', 'monthly', 0.6, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/content-architect', '2025-06-01', 'monthly', 0.7, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/matrice', '2025-06-01', 'monthly', 0.7, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/aide', '2025-06-01', 'monthly', 0.5, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/stratege-cocoon', '2025-06-01', 'monthly', 0.7, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/marina', '2025-06-01', 'monthly', 0.6, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/sea-seo-bridge', '2025-06-01', 'monthly', 0.7, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/a-propos', '2025-06-01', 'monthly', 0.5, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/contact', '2025-06-01', 'monthly', 0.5, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/audit-semantique', '2025-06-01', 'monthly', 0.7, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/google-business', '2025-06-01', 'monthly', 0.7, 'static'),
  ('crawlers.fr', 'https://crawlers.fr/api-integrations', '2025-06-01', 'monthly', 0.6, 'static'),
  -- Landing pages SEO
  ('crawlers.fr', 'https://crawlers.fr/audit-seo-gratuit', '2025-06-01', 'monthly', 0.8, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/analyse-site-web-gratuit', '2025-06-01', 'monthly', 0.8, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/generative-engine-optimization', '2025-06-01', 'monthly', 0.8, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/guide-audit-seo', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/comparatif-crawlers-semrush', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/modifier-code-wordpress', '2025-06-01', 'monthly', 0.6, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/integration-gtm', '2025-06-01', 'monthly', 0.6, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/architecte-generatif', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/indice-alignement-strategique', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/cocoon', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/features/cocoon', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/analyse-logs', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/conversion-optimizer', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/eeat', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/analyse-bots-ia', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/score-geo', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/visibilite-llm', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/pagespeed', '2025-06-01', 'monthly', 0.7, 'landing'),
  ('crawlers.fr', 'https://crawlers.fr/comparatif-claude-code-vs-crawlers', '2025-06-01', 'monthly', 0.7, 'landing'),
  -- Blog index
  ('crawlers.fr', 'https://crawlers.fr/blog', '2025-06-01', 'daily', 0.8, 'static'),
  -- Lexique terms
  ('crawlers.fr', 'https://crawlers.fr/lexique/tls-fingerprinting', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/ja3-ja3s', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/behavioral-analysis', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/ip-rotation-proxies', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/canvas-fingerprinting', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/user-agent-spoofing', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/headless-browsing', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/dom-parsing', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/shadow-dom', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/ssr-vs-csr', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/http2-http3', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/data-normalization', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/schema-org-extraction', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/rag', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/llm-based-parsing', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/self-healing-scrapers', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/crawl-budget', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/concurrency-control', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/ethical-scraping', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/robots-txt-interpretation', '2025-06-01', 'monthly', 0.4, 'lexique'),
  ('crawlers.fr', 'https://crawlers.fr/lexique/aeo-answer-engine-optimization', '2025-06-01', 'monthly', 0.4, 'lexique'),
  -- Pages légales
  ('crawlers.fr', 'https://crawlers.fr/mentions-legales', '2025-01-01', 'yearly', 0.3, 'legal'),
  ('crawlers.fr', 'https://crawlers.fr/politique-confidentialite', '2025-01-01', 'yearly', 0.3, 'legal'),
  ('crawlers.fr', 'https://crawlers.fr/conditions-utilisation', '2025-01-01', 'yearly', 0.3, 'legal'),
  ('crawlers.fr', 'https://crawlers.fr/rgpd', '2025-01-01', 'yearly', 0.3, 'legal'),
  ('crawlers.fr', 'https://crawlers.fr/cgvu', '2025-01-01', 'yearly', 0.3, 'legal');

-- =============================================
-- Trigger: blog_articles → sitemap_entries auto-sync
-- =============================================
CREATE OR REPLACE FUNCTION public.sync_blog_to_sitemap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.sitemap_entries
    SET is_active = false, updated_at = now()
    WHERE loc = 'https://crawlers.fr/blog/' || OLD.slug
      AND domain = 'crawlers.fr';
    RETURN OLD;
  END IF;

  IF NEW.status = 'published' THEN
    INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, page_type, is_active)
    VALUES (
      'crawlers.fr',
      'https://crawlers.fr/blog/' || NEW.slug,
      CURRENT_DATE,
      'monthly',
      0.7,
      'blog',
      true
    )
    ON CONFLICT (domain, loc) DO UPDATE SET
      lastmod = CURRENT_DATE,
      is_active = true,
      updated_at = now();
  ELSE
    UPDATE public.sitemap_entries
    SET is_active = false, updated_at = now()
    WHERE loc = 'https://crawlers.fr/blog/' || NEW.slug
      AND domain = 'crawlers.fr';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_blog_sitemap_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.blog_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_blog_to_sitemap();

-- =============================================
-- Seed existing published blog articles
-- =============================================
INSERT INTO public.sitemap_entries (domain, loc, lastmod, changefreq, priority, page_type, is_active)
SELECT
  'crawlers.fr',
  'https://crawlers.fr/blog/' || slug,
  COALESCE(updated_at::date, CURRENT_DATE),
  'monthly',
  0.7,
  'blog',
  true
FROM public.blog_articles
WHERE status = 'published'
ON CONFLICT (domain, loc) DO NOTHING;
