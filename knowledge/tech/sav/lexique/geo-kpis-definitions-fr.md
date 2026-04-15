# Lexique SAV — KPIs GEO & Termes Métier
Updated: 2026-04-15

## Termes ajoutés au Wiki Expert (/lexique)

### Quotability Index
**Slug** : `quotability-index` | **Catégorie** : Données & IA
Score (0-100) mesurant la probabilité qu'un contenu soit cité verbatim par une IA générative. Basé sur la densité de phrases auto-suffisantes, factuelles et concises. Un score >70 corrèle avec un taux de citation élevé.

### Position Zéro
**Slug** : `position-zero` | **Catégorie** : Données & IA
Le résultat affiché au-dessus du premier lien organique dans Google (Featured Snippet). En 2026, le concept s'étend aux AI Overviews et aux citations des moteurs génératifs.

### Query Fan-Out
**Slug** : `query-fan-out` | **Catégorie** : Données & IA
Mécanisme de décomposition d'une requête complexe en sous-requêtes par les moteurs RAG. Le Fan-Out Score (0-100) mesure la couverture des axes thématiques par le contenu, calculé via les keywords DataForSEO sans appel LLM.

### Chunkability Score
**Slug** : `chunkability-score` | **Catégorie** : Données & IA
Score (0-100) évaluant la facilité de découpage d'une page en fragments exploitables par les moteurs RAG. Calculé via analyse DOM (titres, paragraphes, TOC) sans appel LLM.

### AEO (déjà existant)
**Slug** : `aeo-answer-engine-optimization` | **Catégorie** : Données & IA
Optimisation pour les moteurs de réponse IA. Déjà présent dans le lexique depuis mars 2026.

### SPO (Score de Priorité d'Optimisation)
**Slug** : `spo-score` | **Catégorie** : Données & IA
Score composite (0-100) sur 8 signaux (CTR Gap, conversion, difficulté, trafic, cluster, concurrence, fraîcheur, gravité). Priorise les recommandations d'audit par ROI.

### ETV (Estimated Traffic Value)
**Slug** : `etv-estimated-traffic-value` | **Catégorie** : Données & IA
Valeur monétaire du trafic organique = Σ(trafic estimé × CPC). Représente 25% du calcul de Part de Voix.

### CTR Gap
**Slug** : `ctr-gap` | **Catégorie** : Données & IA
Écart entre le CTR réel (GSC) et le CTR attendu pour la position. Un gap négatif = Quick Win (title/meta à optimiser).

### Voice DNA (ADN de Marque)
**Slug** : `voice-dna` | **Catégorie** : Données & IA
Profil tonal persistant (ton, vocabulaire, persona) stocké dans tracked_sites. Injecté dans Content Architect et Parménion pour cohérence éditoriale.

### Marina (Prospection B2B)
**Slug** : `marina-prospection` | **Catégorie** : Architecture
Module d'audit externe automatisé pour prospects. Architecture en phases (1a/1b/2) avec pipeline LinkedIn assisté.

### Drop Detector
**Slug** : `drop-detector` | **Catégorie** : Données & IA
Détection automatique des baisses de trafic >15% (z-score) avec diagnostic causal (update Google, cannibalisation, perte backlinks).

### Observatoire
**Slug** : `observatoire-sectoriel` | **Catégorie** : Architecture
Veille sectorielle autonome quotidienne (cron 3h00 UTC). Agrège updates Google, tendances, mouvements concurrents.

### Identity Card
**Slug** : `identity-card` | **Catégorie** : Architecture
Enrichissement automatique du profil site : secteur, taille, stack technique, présence sociale. Via APIs Meta et LinkedIn.

### Fair Use
**Slug** : `fair-use-quotas` | **Catégorie** : Éthique & Perf
Quotas par plan : Pro Agency (5K crawls, 80 contenus/mois), Pro Agency+ (15K crawls, 250 contenus). Monitoring temps réel.

### Smart Recommendations
**Slug** : `smart-recommendations` | **Catégorie** : Architecture
Gating progressif par maturité SEO : débutant → intermédiaire → avancé → expert. Évite la surcharge cognitive.

### CRO
**Slug** : `cro-conversion-rate-optimization` | **Catégorie** : Éthique & Perf
Optimisation du taux de conversion. Fusionné avec le SEO dans le Conversion Optimizer de Crawlers.fr.

### SEA
**Slug** : `sea-search-engine-advertising` | **Catégorie** : Données & IA
Publicité payante sur les moteurs. Le bridge SEA→SEO identifie les keywords rentables à passer en organique.

### KPI
**Slug** : `kpi-indicateur-cle` | **Catégorie** : Données & IA
Indicateur clé de performance. En 2026, les KPIs SEO doivent intégrer la dimension GEO (visibilité LLM).

### ROI
**Slug** : `roi-retour-investissement` | **Catégorie** : Éthique & Perf
Ratio rentabilité SEO mesuré automatiquement via les Audit Impact Snapshots (baseline → T+90).

### CTA
**Slug** : `cta-call-to-action` | **Catégorie** : Éthique & Perf
Bouton/texte d'incitation à l'action. Analysé par le Conversion Optimizer sur 4 critères (visibilité, clarté, urgence, alignement).

### B2B / B2C
**Slugs** : `b2b-business-to-business` | **Catégorie** : Éthique & Perf
Modèles commerciaux. Le SEO B2B privilégie l'E-E-A-T et les contenus longs ; le B2C privilégie les fiches produit et la rapidité.

### SaaS
**Slug** : `saas-software-as-a-service` | **Catégorie** : Architecture
Logiciel en ligne par abonnement. Crawlers.fr = SaaS SEO/GEO avec funnel TOFU→MOFU→BOFU.

### RGPD
**Slug** : `rgpd-protection-donnees` | **Catégorie** : Éthique & Perf
Cadre juridique européen sur les données personnelles. Impacte le tracking, les formulaires et le stockage.

## FAQ SAV courantes

**Q : Comment améliorer mon Quotability Index ?**
R : Placer des définitions claires en début de paragraphe, inclure des statistiques sourcées, utiliser la pyramide inversée.

**Q : Mon Fan-Out Score est faible, que faire ?**
R : L'audit identifie les requêtes manquantes avec leur volume. Ajouter des sections H2 dédiées ou créer des pages satellites.

**Q : Mon Chunkability Score est <50, c'est grave ?**
R : Oui, cela signifie que les moteurs IA ne peuvent pas correctement découper votre contenu. Ajouter des sous-titres H2/H3 et une table des matières.

**Q : Qu'est-ce que le SPO et comment l'utiliser ?**
R : Le SPO priorise les recommandations par retour sur investissement. Traiter d'abord les items SPO >80 (quick wins à fort impact), puis descendre.

**Q : Mon CTR Gap est négatif, que faire ?**
R : Réécrire le title et la meta description pour les rendre plus attractifs. C'est un Quick Win : améliorer le trafic sans changer de position.

**Q : Comment fonctionne le Drop Detector ?**
R : Il compare automatiquement vos métriques GSC semaine par semaine. Si une baisse >15% est détectée, une alerte avec diagnostic causal est envoyée.

**Q : Qu'est-ce que le Voice DNA ?**
R : C'est le profil tonal de votre marque, utilisé pour que les contenus générés par IA conservent votre style d'écriture.

**Q : C'est quoi le Fair Use ?**
R : Ce sont les quotas d'utilisation mensuels selon votre plan (crawls, contenus, audits). Visible dans votre tableau de bord en temps réel.
