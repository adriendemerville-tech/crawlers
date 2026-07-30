UPDATE public.linkedin_features_catalog SET capture_steps = v.steps::jsonb
FROM (VALUES
  ('geo-bot-attribution', '["ouverture de l onglet GEO de la console","lecture du bandeau KPI bots IA","zoom sur la carte Attribution bot vers humain","survol du tooltip methodologie"]'),
  ('autopilot-parmenion', '["ouverture de la page Autopilot","selection d un site suivi","lancement d un cycle","defilement du journal de decisions"]'),
  ('strategic-audit', '["saisie d une URL","lancement de l audit","apparition des scores par axe","ouverture d une recommandation detaillee"]'),
  ('content-architect', '["ouverture du Content Architect","choix d un sujet","generation du brief","previsualisation de l article et publication CMS"]'),
  ('cocoon-3d', '["ouverture du Cocoon","rotation du graphe 3D","clic sur un noeud","ouverture du panneau Stratege"]'),
  ('drop-detector', '["ouverture du Drop Detector","selection d une periode","lecture de la courbe de chute","ouverture du diagnostic de cause"]'),
  ('copilot-market', '["ouverture du Copilot","envoi d une demande de diagnostic marche","affichage des resultats concurrents et mots cles"]'),
  ('sea-seo-bridge', '["ouverture de la console onglet SEA","tri des requetes payantes","bascule vers les opportunites SEO"]'),
  ('serp-benchmark', '["saisie d un mot cle","lancement du benchmark","comparaison des positions multi providers"]'),
  ('breathing-spiral', '["ouverture de la Breathing Spiral","lecture de la phase en cours","defilement des taches generees"]'),
  ('ias-strategic-index', '["ouverture de la page IAS","lecture du score global","ouverture du detail par axe"]'),
  ('shield-cloudflare', '["ouverture du wizard CF Shield","choix du mode automatique","validation et affichage du statut actif"]'),
  ('eeat-scoring', '["ouverture du scoring E-E-A-T","lecture des criteres notes","ouverture d une recommandation"]'),
  ('crawlers-api', '["ouverture de la page Developpeurs","creation d une cle API","envoi d un job et suivi du statut"]'),
  ('marina-outreach', '["ouverture de Marina","lancement d un scan de prospects","ouverture d une fiche prospect et de son audit"]')
) AS v(slug, steps)
WHERE linkedin_features_catalog.slug = v.slug;