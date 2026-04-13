# Memory: tech/cms/universal-content-scanner-fr
Updated: 2026-04-13

Le système de scan universel (`cmsContentScanner.ts`) permet d'interroger l'intégralité du contenu (articles publiés et brouillons) sur tous les CMS connectés (WordPress, Shopify, IKtracker) **et le CMS interne** (crawlers.fr). 

## CMS interne (crawlers.fr)
Pour les sites dont le domaine contient `crawlers`, le scanner interroge directement les tables internes :
- **`blog_articles`** : articles de blog (platform: `internal`, content_type: `post`)
- **`seo_page_drafts`** : landing pages SEO (platform: `internal`, content_type: `page`, filtrées par `page_type = 'landing'`)

Cela permet à Parménion et au Stratège Cocoon de :
- Détecter les landing pages existantes avant d'en proposer de nouvelles
- Identifier les brouillons de landing à enrichir ou publier
- Éviter les doublons via la similarité sémantique (≥ 40%)

## CMS externes
WordPress, Shopify et IKtracker sont scannés via leurs APIs respectives. Le module est utilisé par le Stratège Cocoon pour identifier les opportunités de publication ou d'enrichissement de brouillons existants et par Parménion pour éviter les doublons lors de l'exécution automatique en privilégiant la mise à jour (`update-post`) à la création.
