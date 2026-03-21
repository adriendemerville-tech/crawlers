# Memory: tech/admin/admin-features-fr
Updated: now

## Dashboard Admin — Fonctionnalités

### Onglets principaux
- **Utilisateurs** : KPIs par utilisateur, archivage, rôles (`user_roles` avec enum `app_role`)
- **SAV IA** : Historique conversations agent Crawler, indicateurs satisfaction, escalade téléphonique
- **Finances** : Suivi coûts API (Spider, Firecrawl, DataForSEO, SerpAPI), revenus Stripe
- **Algo Training** : Entraînement et monitoring des modèles de scoring (GEO, SEO, prédictions)
- **Bundle Option** : Catalogue APIs tierces (`bundle_api_catalog`), abonnements bundle

### Architecte (Script) — Onglets restreints admin
- **Basique** : Fixes techniques SEO automatiques (title, meta, H1, schema.org, etc.)
- **Super** : Fixes génératifs (FAQ, info box expert, contenus enrichis)
- **Stratégie** : Roadmap stratégique, action plans, fixes liés aux audits
- **Contenu** ⚠️ ADMIN ONLY : Content Architecture Advisor — recommandations architecture de contenu
- **Scribe** ⚠️ ADMIN ONLY, BETA : Générateur de contenu avancé avec 13 paramètres :
  - Prompt (instructions libres)
  - URL cible
  - Type de page (homepage, produit, article, FAQ, landing, catégorie, service, à propos)
  - Longueur cible (court ~500, moyen ~1200, long ~2500+)
  - Photo/média URL
  - Lien CTA cible
  - Mot-clé cible (détection DataForSEO)
  - Ton éditorial (auto via carte d'identité, professionnel, conversationnel, expert, institutionnel, chaleureux)
  - Langue (FR/EN/ES/auto)
  - Persona/cible (B2B décideur, B2C grand public, B2C premium, expert technique, étudiant, audience locale)
  - Niveau de jargon (slider 1-10, bridé par guardrail cohérence)
  - Maillage interne auto via Cocoon
  - URLs concurrentes à analyser (1-3)
- **Multi** : Router multi-pages pour génération de scripts sur plusieurs URLs
- Les onglets Contenu, Scribe et Multi sont **cachés en mode démo** (`openMode`)

### Garde-fous Content Architecture Advisor
- Pénalités de confiance pour innovation disruptive en secteurs conservateurs
- Cap automatique du jargon à 25% si `jargon_distance` > 6
- Filtrage CTAs agressifs pour services publics/ONG
- Continuité tonale vérifiée par rapport au ton existant du domaine

### Edge Functions associées
- `content-architecture-advisor` : Analyse et recommandations de structure de contenu
- `generate-infotainment` : Génération de cartes news/tips SEO/GEO
- `generate-blog-from-news` : Articles de blog auto-générés depuis les news
- `agent-seo-v2` : Audit SEO avancé 7 axes
- `process-script-queue` : File d'attente FIFO pour génération de scripts
