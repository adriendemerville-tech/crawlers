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

### 5 Critères GEO (conditionnels, individuels ou cumulatifs)
Chaque critère s'active selon le contexte (entité, taille, business, cible, SERP, concurrence, GEO score, visibilité LLM, GMB, backlinks) :
1. **Répondre aux questions clés** — ACTIF si article/FAQ/landing, featured snippet, PAA détectés. Renforcé si GEO < 50 ou invisible LLM.
2. **Structurer pour la compréhension** — ACTIF si word_count > 800, page technique, jargon_distance > 4. Renforcé si B2C/étudiant/local.
3. **Passages citables** — ACTIF si GEO < 70, invisible LLM, pas de featured snippet. Renforcé si faible domain_rank, pas de backlinks.
4. **Signaux E-E-A-T** — ACTIF si secteur YMYL, B2B, cible expert. Renforcé si pas de GMB, faible domain_rank, forte concurrence.
5. **Enrichissement sémantique** — TOUJOURS ACTIF. Renforcé si forte concurrence SERP, cible expert technique.

### Sources de données du Content Architecture Advisor
- `tracked_sites` (carte d'identité : secteur, cible, GMB, entity_type, nonprofit_type, jargon_distance, competitors)
- `domain_data_cache` (geo_score, llm_visibility, serp_keywords)
- `backlink_snapshots` (referring_domains, domain_rank)
- `audit_raw_data` (derniers audits)
- `cocoon_sessions` (maillage, clusters)
- DataForSEO (keywords, SERP live)
- Firecrawl (TF-IDF concurrents)

### Edge Functions associées
- `content-architecture-advisor` : Analyse et recommandations de structure de contenu
- `generate-infotainment` : Génération de cartes news/tips SEO/GEO
- `generate-blog-from-news` : Articles de blog auto-générés depuis les news
- `agent-seo-v2` : Audit SEO avancé 7 axes
- `process-script-queue` : File d'attente FIFO pour génération de scripts
