
-- ============================================================
-- LinkedIn Automation Sprint 1: catalogue + posts programmés
-- ============================================================

-- Catalogue des features Crawlers à valoriser
CREATE TABLE public.linkedin_features_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  marketing_angle TEXT NOT NULL,
  target_audience TEXT,
  demo_url TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_features_catalog TO authenticated;
GRANT ALL ON public.linkedin_features_catalog TO service_role;

ALTER TABLE public.linkedin_features_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage linkedin catalog"
  ON public.linkedin_features_catalog
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Posts programmés
CREATE TABLE public.linkedin_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID REFERENCES public.linkedin_features_catalog(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('draft','pending_review','approved','publishing','published','failed','expired','rejected')),
  media_type TEXT NOT NULL DEFAULT 'carousel'
    CHECK (media_type IN ('carousel','video','text_only')),
  generated_text TEXT NOT NULL,
  edited_text TEXT,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  media_generation_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (media_generation_status IN ('not_started','generating','ready','failed')),
  media_error TEXT,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  linkedin_post_urn TEXT,
  linkedin_post_url TEXT,
  publish_error TEXT,
  llm_tokens_used INTEGER,
  llm_model TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_posts_status ON public.linkedin_scheduled_posts(status);
CREATE INDEX idx_linkedin_posts_scheduled ON public.linkedin_scheduled_posts(scheduled_for) WHERE status IN ('approved','pending_review');
CREATE INDEX idx_linkedin_posts_feature ON public.linkedin_scheduled_posts(feature_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_scheduled_posts TO authenticated;
GRANT ALL ON public.linkedin_scheduled_posts TO service_role;

ALTER TABLE public.linkedin_scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage linkedin posts"
  ON public.linkedin_scheduled_posts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Triggers updated_at
CREATE TRIGGER trg_linkedin_features_catalog_updated
  BEFORE UPDATE ON public.linkedin_features_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_linkedin_scheduled_posts_updated
  BEFORE UPDATE ON public.linkedin_scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial du catalogue (15 features Crawlers)
INSERT INTO public.linkedin_features_catalog (slug, title, short_description, marketing_angle, target_audience, demo_url, priority) VALUES
('autopilot-parmenion', 'Autopilot Parménion', 'Pilote SEO/GEO 100% autonome qui audite, planifie et publie chaque semaine.', 'Le premier autopilot SEO qui décide, produit et déploie sans intervention humaine.', 'Fondateurs, PME sans SEO in-house', 'https://crawlers.fr/autopilot', 90),
('cocoon-3d', 'Cocoon Sémantique 3D', 'Visualisation 3D du maillage interne avec détection de cannibalisation et clusters.', 'Voir enfin son SEO comme un graphe, pas comme une liste Excel.', 'Consultants SEO, agences', 'https://crawlers.fr/cocoon', 85),
('strategic-audit', 'Strategic Audit v5', 'Audit GEO+SEO complet avec analyse concurrentielle et priorisation par ROI.', 'Un audit qui te dit quoi faire, dans quel ordre, avec quel impact estimé.', 'Directeurs marketing, agences', 'https://crawlers.fr/audit', 88),
('geo-bot-attribution', 'GEO Bot Attribution', 'Mesure exacte du trafic généré par ChatGPT, Perplexity, Claude et Gemini.', 'Le premier outil qui relie une visite bot IA à une conversion humaine.', 'CMO curieux du GEO/AEO', 'https://crawlers.fr/geo', 92),
('content-architect', 'Content Architect', 'Générateur d''articles SEO/GEO en pipeline 4 étapes (brief → stratège → rédaction → tonalisation).', 'Un rédacteur senior qui écrit à ta voix, pas un LLM générique.', 'Éditeurs, content managers', 'https://crawlers.fr/architect', 87),
('serp-benchmark', 'SERP Benchmark multi-providers', 'Position moyenne pondérée sur DataForSEO, SerpApi, Serper et Bright Data.', 'Une seule position fiable au lieu de 4 fournisseurs qui se contredisent.', 'SEO data-driven', 'https://crawlers.fr/console', 78),
('copilot-market', 'Copilot Market Diagnosis', 'Diagnostic marché instantané via 4 APIs DataForSEO en parallèle.', 'Comprendre un domaine concurrent en 30 secondes chrono.', 'Consultants, prospecteurs', 'https://crawlers.fr/copilot', 80),
('drop-detector', 'Drop Detector', 'Détection ML des chutes de trafic avec diagnostic automatique de la cause.', 'Une alerte qui te dit pourquoi tu chutes, pas juste que tu chutes.', 'Sites e-commerce, médias', 'https://crawlers.fr/drop-detector', 82),
('breathing-spiral', 'Breathing Spiral', 'Stratégie de contenu en spirale respirante : hub, spoke, refresh cyclique.', 'Le premier framework qui rythme la production éditoriale sur 12 mois.', 'Content leads, éditeurs', 'https://crawlers.fr/breathing-spiral', 76),
('sea-seo-bridge', 'SEA → SEO Bridge', 'Convertit tes mots-clés Google Ads rentables en opportunités SEO priorisées.', 'Les mots-clés qui te font gagner en payant sont ta prochaine cible organique.', 'SEA managers, growth', 'https://crawlers.fr/console', 79),
('shield-cloudflare', 'GEO Shield Cloudflare', 'Wizard qui installe les règles Cloudflare pour tracker les bots IA en 3 clics.', 'Trois clics pour voir enfin qui te crawle vraiment (bot IA, SEO, scraper).', 'Ops, DevRel', 'https://crawlers.fr/cf-shield', 74),
('crawlers-api', 'Crawlers API Développeur', 'API REST asynchrone : audit GEO, crawl, SERP, KPIs à la demande, 10c/job.', 'L''API SEO/GEO la moins chère du marché, en pay-as-you-go pur.', 'Développeurs, agences tech', 'https://crawlers.fr/developers', 72),
('marina-outreach', 'Marina — Outreach B2B', 'Audit + white label + séquence LinkedIn automatisée pour prospecter en marque blanche.', 'Ton nouveau SDR SEO qui bosse 7j/7 et coûte 100x moins cher.', 'Agences, freelances', 'https://crawlers.fr/marina', 70),
('ias-strategic-index', 'Indice d''Alignement Stratégique (IAS)', 'Score unique 0-100 qui mesure l''alignement de ton contenu avec ta stratégie business.', 'Une seule métrique pour savoir si ton SEO sert vraiment ta croissance.', 'Directeurs marketing, C-level', 'https://crawlers.fr/ias', 75),
('eeat-scoring', 'E-E-A-T Scoring v3', 'Audit Google E-E-A-T page par page avec plan d''action pour combler chaque signal manquant.', 'Le seul outil qui décompose E-E-A-T en 40 signaux actionnables.', 'SEO seniors, YMYL', 'https://crawlers.fr/eeat', 73)
ON CONFLICT (slug) DO NOTHING;
