ALTER TABLE public.linkedin_features_catalog
  ADD COLUMN IF NOT EXISTS topic_type text NOT NULL DEFAULT 'feature';

ALTER TABLE public.linkedin_features_catalog
  DROP CONSTRAINT IF EXISTS linkedin_features_catalog_topic_type_check;

ALTER TABLE public.linkedin_features_catalog
  ADD CONSTRAINT linkedin_features_catalog_topic_type_check
  CHECK (topic_type IN ('feature','workflow','problem','blog_article','pricing','lead_magnet'));

CREATE INDEX IF NOT EXISTS idx_lfc_topic_type ON public.linkedin_features_catalog(topic_type, is_active);

INSERT INTO public.linkedin_features_catalog
  (slug, title, short_description, marketing_angle, target_audience, priority, is_active, topic_type, capture_route, evidence_table)
VALUES
  ('workflow-audit-to-publication', 'Du crawl à la publication CMS', 'Workflow transversal : crawl, audit stratégique, workbench, brief éditorial, génération, publication CMS et contre-audit.', 'Montrer la chaîne complète plutôt qu''un module isolé : la valeur naît de l''enchaînement automatisé.', 'fondateurs et responsables SEO qui pilotent seuls leur contenu', 84, true, 'workflow', 'https://crawlers.fr/app/console?tab=drafts', 'parmenion_decision_log'),
  ('workflow-geo-visibility-loop', 'Boucle de visibilité GEO', 'Workflow transversal : logs bots, vérification rDNS/ASN, attribution bot vers humain, KPIs GEO, plan d''action.', 'Relier la venue d''un bot IA à une visite humaine réelle, bout en bout.', 'CMO et consultants qui doivent prouver l''impact des IA génératives', 83, true, 'workflow', 'https://crawlers.fr/app/console?tab=geo', 'ai_attribution_events'),
  ('workflow-competitive-pressure', 'Pression concurrentielle et priorisation', 'Workflow transversal : suivi concurrents, SERP benchmark, keyword universe, priorisation des pages à traiter.', 'La priorisation n''est pas un tableau de scores, c''est une réaction à la concurrence observée.', 'agences et consultants multi-clients', 77, true, 'workflow', 'https://crawlers.fr/app/ranking-serp', 'competitor_tracked_urls'),
  ('problem-invisible-in-ai-answers', 'Invisible dans les réponses des IA', 'Problème visé : un site bien référencé sur Google mais jamais cité par ChatGPT, Perplexity ou Google AI Overviews.', 'Nommer la douleur avant l''outil : le trafic baisse alors que les positions tiennent.', 'dirigeants qui voient leur trafic organique s''éroder', 86, true, 'problem', 'https://crawlers.fr/app/console?tab=geo', 'geo_visibility_snapshots'),
  ('problem-content-cannibalization', 'Cannibalisation et contenu qui s''annule', 'Problème visé : produire beaucoup d''articles qui se concurrencent entre eux et diluent l''autorité.', 'Le volume de contenu sans architecture sémantique détruit de la valeur.', 'responsables contenu et agences', 81, true, 'problem', 'https://crawlers.fr/app/cocoon', 'cocoon_sessions'),
  ('problem-traffic-drop-unexplained', 'Chute de trafic sans explication', 'Problème visé : une baisse brutale de trafic sans savoir si c''est un update, une désindexation, un bug technique ou la saisonnalité.', 'Le diagnostic différentiel plutôt que la panique.', 'fondateurs et e-commerçants', 80, true, 'problem', 'https://crawlers.fr/app/console?tab=tracking', 'drop_diagnostics'),
  ('blog-latest-article', 'Dernier article du blog Crawlers', 'Sujet dynamique : le générateur sélectionne un article publié récemment sur crawlers.fr/blog et en tire un post.', 'Recycler la production éditoriale du site en contenu social, avec lien vers l''article.', 'audience SEO/GEO francophone', 71, true, 'blog_article', 'https://crawlers.fr/blog', 'blog_articles'),
  ('pricing-plans', 'Tarifs et plans Crawlers', 'Grille tarifaire : Free, Premium, Pro Agency, Agency Premium, plus le pay as you go développeur via wallet.', 'Assumer le prix publiquement, expliquer ce que couvre chaque palier et pourquoi.', 'acheteurs en phase de comparaison', 68, true, 'pricing', 'https://crawlers.fr/pricing', NULL),
  ('pricing-dev-payg', 'Pay as you go API développeur', 'Wallet développeur crédité puis débité par job via l''API Crawlers, sans abonnement.', 'Un modèle de prix à l''usage pour les intégrateurs, sans engagement.', 'développeurs et intégrateurs', 62, true, 'pricing', 'https://crawlers.fr/developers', 'dev_wallets'),
  ('lead-magnet-free-audit', 'Audit SEO GEO gratuit', 'Lead magnet : audit expert gratuit d''une URL, score GEO, recommandations priorisées, rapport partageable.', 'Donner la valeur avant de demander quoi que ce soit.', 'prospects froids', 69, true, 'lead_magnet', 'https://crawlers.fr/audit-expert', 'audits'),
  ('lead-magnet-guides', 'Guides et lexique GEO', 'Lead magnet : guides SEO/GEO et lexique expert accessibles librement sur crawlers.fr.', 'Contenu de référence gratuit qui installe l''autorité et capte la recherche informationnelle.', 'consultants et curieux du GEO', 64, true, 'lead_magnet', 'https://crawlers.fr/guides', NULL),
  ('lead-magnet-extension', 'Extension navigateur Crawlers', 'Lead magnet : extension navigateur pour auditer une page en un clic depuis le contexte de navigation.', 'Un outil gratuit utilisé au quotidien vaut mieux qu''un livre blanc téléchargé une fois.', 'praticiens SEO', 60, true, 'lead_magnet', 'https://crawlers.fr/extension', NULL)
ON CONFLICT (slug) DO UPDATE SET
  topic_type = EXCLUDED.topic_type,
  short_description = EXCLUDED.short_description,
  marketing_angle = EXCLUDED.marketing_angle,
  target_audience = EXCLUDED.target_audience,
  capture_route = EXCLUDED.capture_route,
  is_active = true;