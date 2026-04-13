# Memory: tech/crawl/comprehensive-engine-v5-fr
Updated: 2026-04-13

## Moteur de Crawl v5 — Two-Phase Detect + Analyze

### Architecture à 2 phases

**Phase 1 : Détection (gratuite, pas de crédits)**
- Bouton "Détecter les pages" déclenche `crawl-site` avec `mode: 'detect'`
- Découverte hybride : Sitemap XML + Spider.cloud/Firecrawl map + CMS content discovery (interne + WordPress + Shopify + IKtracker)
- Retourne la liste complète des URLs + répertoires catégorisés
- L'utilisateur ajuste le slider et les filtres sur le total réel

**Phase 2 : Analyse (consomme les crédits)**
- Bouton "Lancer le crawl" déclenche `crawl-site` avec `mode: 'analyze'` (défaut)
- Scraping limité au `maxPages` choisi par l'utilisateur
- Crawl incrémental : réutilisation des pages des 12 dernières heures

**Passe 2 automatique : Link Discovery**
- Pendant le scraping, les liens internes `<a href>` sont extraits
- Les nouvelles URLs détectées sont ajoutées dynamiquement à la queue
- Plafond : +200 URLs max au-delà du plan initial (pas de récursion infinie)
- `total_pages` mis à jour en temps réel dans `site_crawls`

### Changements v4 → v5
- **Suppression DataForSEO** `site:domain` pour le comptage de pages (gonflé, non fiable)
- **Suppression du cap `pageLimit`** pendant la découverte — toutes les URLs sont trouvées
- **Ajout mode `detect`** — mapping complet sans scraping ni crédits
- **Extension passe 2** — +200 URLs max au-delà du plan initial
- **UI 2 boutons** — "Détecter" → "Analyser" (le bouton change après détection)
- **Estimation basée sur sitemap** en priorité (pas sur `indexed_pages` DataForSEO)

### Sources de découverte (ordre)
1. Sitemap XML (`fetch-sitemap-tree`)
2. Spider.cloud / Firecrawl map (cascade)
3. CMS scan (`cmsContentScanner`) : interne (`blog_articles` + `seo_page_drafts`), WordPress, Shopify, IKtracker
4. Liens internes découverts pendant le scraping (passe 2)

### Garde-fous
- Bouton 'Analyser' désactivé tant que la détection n'est pas terminée
- Timeout global 120s par job
- Bouton 'Stop' préserve les pages déjà crawlées
- Passe 2 plafonnée à +200 URLs
- Isolation par `user_id` et normalisation d'URL
