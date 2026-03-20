
-- Catalog of available APIs for the bundle marketplace
CREATE TABLE public.bundle_api_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL,
  api_url text NOT NULL,
  seo_segment text NOT NULL,
  crawlers_feature text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- User bundle subscriptions
CREATE TABLE public.bundle_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_apis uuid[] NOT NULL DEFAULT '{}',
  api_count integer NOT NULL DEFAULT 0,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.bundle_api_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read catalog" ON public.bundle_api_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage catalog" ON public.bundle_api_catalog FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own subscriptions" ON public.bundle_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own subscriptions" ON public.bundle_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own subscriptions" ON public.bundle_subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Seed 20 popular SEO/marketing APIs
INSERT INTO public.bundle_api_catalog (api_name, api_url, seo_segment, crawlers_feature, display_order) VALUES
  ('Ahrefs', 'https://ahrefs.com/api', 'Backlinks & Domain Authority', 'Audit Expert — profil de liens', 1),
  ('SEMrush', 'https://www.semrush.com/api/', 'Keywords & Competitive Intelligence', 'Audit Stratégique — concurrents', 2),
  ('Moz', 'https://moz.com/products/api', 'Domain Authority & Link Metrics', 'Audit Expert — métriques DA/PA', 3),
  ('Majestic', 'https://majestic.com/api', 'Backlinks & Trust Flow', 'Audit Expert — Trust/Citation Flow', 4),
  ('SpyFu', 'https://www.spyfu.com/apis', 'Keywords & PPC Intelligence', 'Audit Stratégique — mots-clés payants', 5),
  ('SERPapi', 'https://serpapi.com/', 'SERP Tracking & Scraping', 'Suivi positions — SERP live', 6),
  ('DataForSEO', 'https://dataforseo.com/apis', 'SERP & Keywords & Backlinks', 'Multi-crawl — données SERP', 7),
  ('Screaming Frog API', 'https://www.screamingfrog.co.uk/seo-spider/api/', 'Technical SEO & Crawling', 'Crawl multi-pages — audit technique', 8),
  ('Google Search Console', 'https://developers.google.com/webmaster-tools', 'Indexation & Search Performance', 'Mes sites — performance search', 9),
  ('Google PageSpeed', 'https://developers.google.com/speed/docs/insights/v5/get-started', 'Core Web Vitals & Performance', 'Audit Expert — vitesse', 10),
  ('Google Analytics (GA4)', 'https://developers.google.com/analytics/devguides/reporting/data/v1', 'Traffic & Engagement', 'Mes sites — trafic & engagement', 11),
  ('Bing Webmaster Tools', 'https://www.bing.com/webmasters/api', 'Indexation Bing & Search', 'Audit Expert — couverture Bing', 12),
  ('Clearscope', 'https://www.clearscope.io/', 'Content Optimization & NLP', 'Audit Stratégique — optimisation contenu', 13),
  ('Surfer SEO', 'https://surferseo.com/', 'On-Page & Content Score', 'Audit Expert — score on-page', 14),
  ('BrightLocal', 'https://www.brightlocal.com/api/', 'Local SEO & Citations', 'GMB — SEO local & citations', 15),
  ('Copyscape', 'https://www.copyscape.com/apiconfigure.php', 'Duplicate Content Detection', 'Crawl multi-pages — contenu dupliqué', 16),
  ('Hunter.io', 'https://hunter.io/api', 'Email Outreach & Link Building', 'Cocoon — outreach backlinks', 17),
  ('Mangools (KWFinder)', 'https://mangools.com/kwfinder', 'Keyword Research & SERP', 'Audit Stratégique — recherche KW', 18),
  ('ContentKing', 'https://www.contentking.com/', 'Real-time SEO Monitoring', 'Mes sites — monitoring temps réel', 19),
  ('Sistrix', 'https://www.sistrix.com/api/', 'Visibility Index & SERP Features', 'Suivi positions — index de visibilité', 20);

CREATE TRIGGER update_bundle_subscriptions_updated_at BEFORE UPDATE ON public.bundle_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
