---
title: "Documentation SAV Crawlers.fr"
version: "6.0"
date: "2026-04-23"
usage: "Base de connaissance agent Limova + documentation publique /aide"
confidentialite: "Public"
---

# Centre d'aide Crawlers.fr

## 1. Démarrer avec Crawlers.fr

### Créer son compte
Rendez-vous sur https://crawlers.fr/signup.
L'inscription est gratuite et débloque :
- L'audit technique SEO 200 points (1 par jour)
- 20 crédits offerts dès l'inscription
- L'accès au tableau de bord personnel

Pour activer les fonctionnalités avancées (tracking GSC, GA4, historique SERP), connectez vos comptes Google via OAuth depuis votre tableau de bord.

### Lancer son premier audit
1. Depuis la page d'accueil ou /audit-expert, entrez l'URL de votre site
2. Choisissez le type d'audit souhaité (Expert SEO gratuit ou Stratégique IA premium)
3. L'audit s'exécute en arrière-plan — vous recevez une notification à la fin
4. Consultez votre rapport depuis le tableau de bord

Durée moyenne : 45 à 90 secondes pour un audit expert, 2 à 5 minutes pour un audit stratégique IA.

### Connecter Google Search Console
1. Depuis votre tableau de bord, cliquez sur "Connecter GSC"
2. Autorisez l'accès via votre compte Google
3. Sélectionnez la propriété GSC correspondant à votre site
4. Les données historiques (clics, impressions, CTR, positions) sont importées automatiquement

Prérequis : votre site doit être vérifié dans Google Search Console avant la connexion.

### Connecter Google Analytics 4
1. Depuis votre tableau de bord, cliquez sur "Connecter GA4"
2. Autorisez l'accès via votre compte Google
3. Sélectionnez la propriété GA4 correspondant à votre site
4. Les données (sessions, engagement, bounce rate) alimentent le Triangle Prédictif et les rapports de tracking

---

## 2. Comprendre vos scores

### Qu'est-ce que le GEO Score ?
Le GEO Score mesure la capacité de votre site à être cité et recommandé par les moteurs de réponse IA (ChatGPT, Perplexity, Gemini, Claude).

Un score élevé signifie que vos contenus sont :
- Bien structurés pour être compris par les LLMs
- Rédigés avec une autorité thématique claire
- Balisés avec des données structurées (JSON-LD)
- Exempts de signaux négatifs (contenu mince, duplication, hallucinations)

Le GEO Score est calculé sans inscription, gratuitement, depuis la page d'accueil.

### Qu'est-ce que le Score IAS ?
L'Indice d'Alignement Stratégique (IAS) mesure la cohérence entre votre contenu, votre structure technique et les attentes combinées de Google et des moteurs IA.

Il repose sur 23 variables réparties en 4 axes :
- Alignement sémantique (contenu vs intention)
- Alignement technique (structure vs standards)
- Alignement autorité (E-E-A-T vs signaux perçus)
- Alignement GEO (visibilité LLM vs potentiel)

Un IAS > 70 indique un site bien aligné. En dessous de 40, des correctifs prioritaires sont nécessaires.

### Qu'est-ce que la Visibilité LLM ?
La Visibilité LLM mesure le taux de citation de votre site ou marque dans les réponses générées par ChatGPT, Perplexity, Gemini et Claude sur vos mots-clés cibles.

Elle est calculée via une interrogation parallèle multi-modèles — pas un seul LLM, mais quatre simultanément — pour donner un score représentatif et non biaisé.

### Qu'est-ce que la Part de Voix SEO ?
La Part de Voix est un score pondéré multi-canaux :
- 40% LLM (visibilité dans les moteurs IA)
- 35% SERP (positions Google organique)
- 25% ETV (estimation du trafic potentiel)

C'est votre indicateur de présence globale sur un marché ou une thématique donnée.

### Qu'est-ce que le Triangle Prédictif ?
Le Triangle Prédictif est un algorithme propriétaire qui corrèle vos données GSC et GA4 pour prédire votre trafic organique sur les 90 prochains jours.

Précision mesurée : MAPE inférieure à 15%.
Disponible uniquement si GSC et GA4 sont connectés.

### Pourquoi mon score a-t-il baissé ?
Plusieurs raisons possibles :
- Une mise à jour algorithmique Google récente
- Une baisse de fréquence de publication
- Des erreurs techniques apparues (404, noindex)
- Une perte de backlinks autoritaires
- Une évolution des réponses LLM sur vos mots-clés cibles

Consultez l'historique de vos scores dans votre tableau de bord pour identifier la date de la baisse.

---

## 3. Les features en détail

### Audit Expert SEO
Analyse technique complète de votre site en 200 points couvrant :
- Technique : indexation, robots.txt, sitemap, redirections, erreurs HTTP
- Sémantique : balises title, meta, H1-H6, densité de mots-clés
- Performance : Core Web Vitals, PageSpeed, temps de chargement
- Sécurité : HTTPS, mixed content, vulnérabilités
- IA & GEO : accessibilité LLM, citabilité, données structurées

Les résultats incluent un **graphique radar de qualité** montrant les scores par catégorie (Performance, Technique, Contenu, IA & GEO, Sécurité) avec un score global /200. Ce radar apparaît aussi en haut du rapport PDF exporté.

Disponible : 1 fois par jour en freemium inscrit. Illimité en Pro Agency.

### Audit Stratégique IA (GEO)
Analyse approfondie multi-axes avec scoring IA :
- Score IAS (23 variables)
- Analyse E-E-A-T
- GEO Readiness : citabilité, accessibilité IA
- Autorité de marque et signaux sociaux
- Recommandations prioritaires classées par impact
- Génération de plan d'action

Les résultats incluent un **graphique radar adaptatif** avec des axes dynamiques (Performance, Contenu, IA & GEO, Citabilité, GEO Ready, Marque, Social, Marché) selon les données disponibles. Ce radar apparaît aussi en haut du rapport PDF exporté.

Coût : 1 crédit.

### Audit E-E-A-T
Évaluation complète des signaux E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) de votre site :
- **Score pondéré algorithmique** : chaque pilier a un poids différent dans le score final
  - Trustworthiness ×4.0 (pilier dominant)
  - Expertise ×2.5
  - Authoritativeness ×2.5
  - Experience ×1.5
- **Pénalités automatiques** sur le pilier Trustworthiness :
  - Absence de citations externes / liens sortants : -15 points
  - Domaine de moins de 2 ans : -10 points
  - Pas de HTTPS : -20 points
- **Sources de données** : crawl HTML multi-pages, backlinks DataForSEO, referrals GA4, données Google Business Profile, âge du domaine (carte d'identité + Wayback Machine)
- Rapport avec décomposition visuelle des contributions par pilier et affichage des pénalités appliquées

Coût : utilise le fair use mensuel (3/mois freemium, 15/mois Pro, 20/mois Pro+).

Benchmark de votre site vs jusqu'à 3 concurrents :
- Radar Chart comparatif
- Analyse différentielle feature par feature
- Score IAS comparé
- Identification des gaps et opportunités

Coût : 4 crédits.

### Audit Local SEO
Analyse de votre présence locale :
- Audit Google My Business (fiche, avis, posts)
- Positionnement Pack Local
- Cohérence NAP (Nom, Adresse, Téléphone)
- Recommandations de visibilité locale
- Si GMB est connecté, les données réelles de votre fiche alimentent le diagnostic (au lieu d'estimations tierces)

### Google My Business (GMB / GBP)
Accessible depuis Console > onglet GMB (réservé aux abonnés Pro Agency).

**Connexion (séparée de GSC/GA4) :**
1. Depuis Console > onglet Google Business, cliquez sur le bouton **"Connecter Google Business"** (icône prise)
2. Autorisez l'accès via votre compte Google — le flux OAuth est **dédié GBP** (scope `business.manage` uniquement), séparé de la connexion GSC/GA4 pour éviter les conflits de permissions
3. Vos fiches d'établissement sont automatiquement détectées et associées
4. Vous pouvez également connecter/déconnecter GBP depuis Console > API Externes

**Déconnexion :**
- Depuis l'onglet GMB : bouton "Déconnecter" dans la bannière de connexion
- Depuis Console > API Externes : bouton dédié GBP
- La déconnexion GBP est **indépendante** de GSC/GA4 : déconnecter l'un n'affecte pas l'autre

**Fonctionnalités :**
- Consultation et réponse aux avis Google (note moyenne, tendance, historique)
- Publication de Google Posts (actualités, offres, événements)
- Tableau de bord performances locales (vues, recherches, clics, appels, demandes d'itinéraire)
- Gestion multi-établissements avec glisser-déposer
- Informations de la fiche (nom, adresse, catégorie, horaires)
- Les données GMB alimentent automatiquement l'Audit Local SEO et le diagnostic de la Stratégie 360°
- **Suggestions de mots-clés** (onglet "Suggestions KW") : génère 5 mots-clés locaux stratégiques à partir du nom, de la catégorie et de la ville de l'établissement via SerpAPI. Chaque mot-clé peut être ajouté à un suivi local dédié (table `gmb_tracked_keywords`). Les résultats sont mis en cache 24h pour optimiser les coûts API.
- **Concurrence locale** (onglet "Concurrence") : scanne les concurrents analogues sur Google Maps via Google Places API (autocomplete + détails). Affiche les concurrents avec leur note moyenne, nombre d'avis et adresse. Classification automatique : Goliath (#1), Concurrent direct (#2-3), Challenger (#4-7), Inspiration (#8+). Les concurrents peuvent être supprimés au survol de leur carte. Le rayon de recherche est estimé automatiquement selon la catégorie d'activité.

**Pourquoi connecter GBP ?** Une fiche Google Business bien optimisée est l'un des meilleurs leviers pour améliorer sa visibilité auprès des moteurs IA (ChatGPT, Gemini, Perplexity) et booster son GEO Score.

**Prérequis :** abonnement Pro Agency et compte Google propriétaire/gestionnaire de la fiche.

**Interface trilingue :** disponible en français, anglais et espagnol.

### Audit Matrice de Prompts (immersif, temps réel)
Test de votre visibilité sur des prompts cibles dans plusieurs LLMs simultanément, avec une expérience entièrement repensée :
- Définissez vos prompts cibles (ex : "meilleure agence SEO Paris")
- Crawlers interroge ChatGPT, Gemini, Perplexity, Claude
- Résultats : taux de citation, sentiment, position dans la réponse
- **Streaming temps réel** : chaque critère apparaît dès qu'il est évalué (pas d'attente de fin d'audit). Le cube 3D et la table pivot se remplissent progressivement.
- **Trois visualisations interconnectées** : table pivot triable (vue analytique), cube 3D Three.js (critère × moteur × variant de prompt — couleur = score) et drill-down voxel détaillant le verdict, l'extrait de réponse et la tactique correctrice à appliquer.
- **Gestion des prompts** : les prompts sauvegardés sont affichés sous forme de cartes, renommables (double-clic ou icône crayon), supprimables au survol, et triés automatiquement par dernière utilisation (le plus récent en premier).
- **Reprise d'audit interrompu** : si l'audit a été coupé (fermeture d'onglet, perte de connexion), un bandeau "Reprendre l'audit interrompu (X/Y critères)" s'affiche au retour sur la page Matrice et propose de reprendre exactement là où vous en étiez.
- **Historique & comparaison** : la vue "Historique" (accessible depuis la top bar) liste tous vos audits matriciels passés, permet de rejouer un audit archivé et de comparer le delta de scores entre deux audits pour mesurer vos progrès dans le temps.

### Rapports (Console)
Onglet dédié à la gestion des rapports (réservé Pro Agency) :
- **Menu vertical gauche** avec les URLs trackées depuis "Mes Sites" + un menu "Autres" pour les rapports hors domaines suivis
- **Système de dossiers imbriqués** : créez, renommez, supprimez des dossiers (avec avertissement du nombre de rapports contenus)
- **Actions rapports** : renommer, archiver, télécharger le PDF
- **Archives** : les éléments supprimés sont rangés dans un menu déroulant en bas, avec possibilité de restauration
- **Drag & drop** pour réordonner les sites dans le menu latéral

### Intégration IKTracker
Pour les sites hébergés sur IKTracker, le bouton "Brancher" dans Console > Mes Sites fonctionne différemment :
- **Auto-détection** : l'API IKTracker est testée automatiquement au chargement — le bouton s'affiche en vert si l'API répond OK
- **Toggle direct** : cliquer sur le bouton active/désactive la connexion API IKTracker sans ouvrir de modale
- Le bridge `iktracker-actions` permet les opérations CRUD complètes (pages et articles) via l'API Content d'IKTracker

### Cocon Sémantique 3D
Visualisation interactive de l'architecture sémantique de votre site en 3D (Three.js) :
- Clusters thématiques calculés via analyse sémantique avancée
- Liens internes visualisés et analysés
- Recommandations de maillage automatiques
- **Indicateur de backlinks** : les nœuds recevant des backlinks externes sont marqués d'un anneau doré pulsant et d'un badge indiquant le nombre de domaines référents. Cela permet d'identifier visuellement les pages bénéficiant d'autorité externe.
- **Stratège Cocoon** : chat IA intégré pour affiner la stratégie, avec mémoire persistante et reprise de session. Le Stratège peut expliquer les backlinks de chaque page (sources, ancres, impact sur l'autorité).
- **Scan Backlinks ciblé** : depuis la page Crawl, un bouton permet de scanner les backlinks DataForSEO des 10 pages les plus autoritaires (~$0.20). Les résultats alimentent le graphe Cocoon et le rapport PDF.
- **Auto-Maillage IA** : depuis le panneau de nœud, un bouton déclenche l'analyse automatique du contenu de la page pour identifier les meilleurs emplacements d'ancres internes. Le système utilise un **pré-scan intelligent** (détection des titres cibles déjà présents dans le texte, économisant 20-40% d'appels IA) puis l'IA sélectionne les ancres contextuelles optimales. Les suggestions incluent le texte d'ancrage, la phrase de contexte et un score de confiance.
- **Exclusion granulaire** : chaque page peut être configurée individuellement pour exclure les liens sortants, les liens entrants, ou les deux. Cela protège les pages sponsorisées, désindexées ou légales du maillage automatique.
- Export et persistance des sessions

Disponible en Pro Agency.

### Diagnostic de Chute
Détection automatique et prédictive des baisses de trafic :
- **Réactif** : détecte les chutes en cours vs baseline 4 semaines
- **Prédictif** : alerte en amont quand la probabilité de chute ≥ 80%
- Cross-analyse multi-sources : GSC, audits techniques, E-E-A-T, backlinks
- Alertes dans le bandeau défilant de la console
- Surveillance automatique en arrière-tâche de tous vos sites trackés

Gratuit pour les abonnés Pro Agency. 3 crédits par analyse pour les autres.

### Stratégie 360° (mode avancé du Cocon)
Le mode Stratégie 360° est accessible via le bouton boussole dans le chat du Cocon Sémantique. Il effectue automatiquement :

1. **Diagnostic multi-axes** : analyse de 4 dimensions en parallèle
   - **Contenu** : pages minces, contenu dupliqué, pages sans mots-clés, ratio texte/HTML
   - **Sémantique** : gaps de mots-clés SERP, cohérence sémantique parent-enfant, inadéquation titre/ancres, cannibalisations
   - **Structure** : pages profondes (>3 clics), pages orphelines, chaînes de redirections, erreurs 404/5xx
   - **Autorité** : profil de backlinks (domaine + par page), diversité des ancres, liens perdus, Domain Rank, pages piliers sans backlinks externes

2. **Plan d'action intelligent** : jusqu'à 8 tâches par cycle, classées par un score combinant impact (40%), urgence (30%), ancienneté (15%) et faisabilité (15%)

3. **3 axes de développement** : l'assistant vous propose 3 orientations stratégiques — vous en choisissez une seule pour concentrer les efforts

4. **Boucle rétro-active** : à chaque nouveau cycle, le système réévalue l'impact réel des recommandations passées en croisant les données GSC et GA4. Les actions inefficaces sont signalées pour correction ou annulation.

Les tâches validées sont transférées dans Console > Plans d'Action et peuvent devenir un calendrier éditorial ou des tâches techniques.

### Architecte Génératif
Génération automatique de codes correctifs multi-pages :
- JSON-LD (SoftwareApplication, Organization, FAQPage, BreadcrumbList...)
- Balises meta optimisées
- Attributs de maillage interne
- Intégration directe : WordPress, GTM ou SDK

Coût : 1 crédit.

### Content Architect (onglet avancé de l'Architecte)
Générateur de contenus pré-configurés selon les recommandations de la stratégie 360° :
- Type de contenu (article, pillar page, FAQ, glossaire...)
- Longueur optimale et mots-clés cibles
- Structure éditoriale complète : résumé, tableau de synthèse pour LLM, FAQ, sources obligatoires, articles connexes, CTA
- Médias et backlinks internes/externes
- Calendrier éditorial (pour les comptes Pro Agency)

### Crawl Multi-Pages
Analyse récursive de votre site :
- **Pro Agency** : jusqu'à 5 000 pages par mois (fair use), slider jusqu'à 20 pages par crawl
- **Pro Agency +** : jusqu'à 50 000 pages par mois, slider jusqu'à 50 pages par crawl
- Détection d'erreurs techniques page par page
- Analyse du maillage interne
- **Graphique circulaire des codes HTTP** : visualisation de la distribution des réponses HTTP (200 OK en vert, redirections 3xx, erreurs client 4xx, erreurs serveur 5xx) dans les résultats et dans le rapport PDF
- Rapport exportable
- **Quota dynamique** : le système vérifie le plan d'abonnement de l'utilisateur et son quota restant avant chaque crawl. Si le quota est atteint, le bouton vibre et propose le Pack Ultime.

Disponible en Pro Agency (inclus dans l'abonnement).

### Tracking SERP
Suivi hebdomadaire de vos positions Google :
- Mots-clés trackés et leurs évolutions
- Historique des positions dans le temps
- Détection des Quick Wins (positions 4-10)

### Agents Autonomes
- Agent SEO : optimisation automatique du contenu (blog : libre, landing pages : max 10% de modification)
- Agent CTO : maintenance algorithmique automatique, self-critique et proposition de patches

### Conversion Optimizer
Audit UX/CRO contextuel par IA sur 7 axes :
- **Ton & Voix** : adaptation au positionnement et à l'audience cible
- **Pression CTA** : placement, fréquence, wording des appels à l'action
- **Alignement** : cohérence page ↔ positionnement ↔ modèle commercial
- **Lisibilité** : structure, paragraphes, vocabulaire adapté
- **Conversion** : preuves sociales, proposition de valeur, éléments de réassurance
- **Expérience mobile** : accessibilité des CTAs, taille des blocs de texte
- **Utilisation des mots-clés** : densité, naturalité, placement (H1, H2, body)

L'analyse est calibrée sur le contexte business (type, audience, maturité, voice DNA, objectifs). Les suggestions critiques (critical/high) alimentent automatiquement le **Workbench Architect** avec `source_function = 'analyze-ux-context'`, permettant l'exécution par Code Architect ou Content Architect.

Accessible depuis Console → Mes Sites → bouton UX, ou via /app/conversion-optimizer. Nécessite un crawl complété. Aucun re-crawl : utilise les données existantes de `crawl_pages`.

### Analyse de Logs Serveur
Ingestion et analyse des fichiers de logs HTTP pour comprendre le comportement réel des robots sur votre site :
- **40+ bots détectés** : Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot, Bytespider, Google-Extended et plus
- **Budget crawl** : visualisation de la répartition du crawl Google page par page. Le budget crawl est le nombre limité de pages que Google explore par session. Si ce budget est gaspillé sur des pages inutiles (404, paramètres dupliqués, redirections en chaîne), vos pages stratégiques sont moins crawlées et indexées plus lentement.
- **Récurrence de crawl** : mesure de la fréquence à laquelle chaque bot revient explorer une page. Une page crawlée fréquemment est perçue comme prioritaire par Google. Une page jamais crawlée est ignorée. L'analyse de récurrence identifie les pages sous-crawlées à booster (maillage, sitemap) et les pages sur-crawlées à protéger (robots.txt, noindex).
- **Bots IA vs moteurs classiques** : répartition du crawl entre bots IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) et moteurs classiques (Googlebot, Bingbot). Cette répartition impacte directement votre visibilité GEO : un site jamais crawlé par GPTBot ne sera jamais cité par ChatGPT.
- **Gaspillage de crawl** : identification des pages crawlées inutilement (404, 500, redirections en chaîne, pages avec paramètres). Le ratio hits/pages révèle l'efficacité de votre budget crawl.
- **Pages orphelines** : détection des pages jamais visitées par les robots
- **Erreurs serveur** : identification des 404, 500, redirections en chaîne
- **Monitoring continu** : ingestion via connecteur Cloudflare Worker ou import direct (Apache, Nginx, IIS)
- **Sécurité bots** : repérage des scrapers agressifs et bots malveillants
- **Catégorisation automatique** : chaque bot est classé (search_engine, ai_crawler, social, malicious)

**Pourquoi analyser ses logs ?** Les données GSC montrent les résultats (positions, clics), mais les logs montrent les causes : si Googlebot ne crawle pas une page, elle ne sera jamais indexée. Si GPTBot ne la visite jamais, elle ne sera jamais citée par ChatGPT. L'analyse de logs est le chainon manquant entre le contenu publié et sa visibilité réelle.

Disponible en Pro Agency. Page dédiée : /analyse-logs.

### Marina — Pipeline de Prospection B2B
Marina est un pipeline d'audit automatisé disponible via API publique et dashboard admin.

**API publique Marina Embed :**
- Endpoint : `POST /functions/v1/marina`
- Authentification : header `x-marina-key` (clé API depuis Console)
- Paramètres body JSON :
  - `url` (obligatoire) : URL du site à auditer
  - `lang` (optionnel) : langue du rapport — `"fr"`, `"en"` ou `"es"`. Si omis, la langue est auto-détectée via l'attribut `<html lang="...">` du site, puis par heuristique de contenu. Défaut : `"en"`.
  - `callback_url` (optionnel) : URL de webhook pour recevoir le rapport automatiquement
- Coût : 5 crédits par rapport
- Durée : ~3 minutes, progression via polling (GET ?job_id=xxx) ou webhook
- Deux URLs de rapport : `report_url` (téléchargement, expire 7j) et `report_view_url` (affichage iframe direct)

**Fonctionnalités du rapport :**
- Orchestre en une seule passe : Crawl, Cocon sémantique, Audit Expert SEO, Audit Stratégique GEO
- Rapport HTML de 15+ pages avec toolbar interactive trilingue (FR/EN/ES)
- Rapport généré dans la langue demandée (paramètre explicite prioritaire, auto-détection en fallback)
- Stocké dans le bucket de rapports partagés, accessible via lien signé (7 jours)

**Branding personnalisable (Pro Agency) :**
- Configurable depuis Console → Branding → section Marina
- Personnalisation de l'intro du rapport, du CTA (texte + URL)
- Option pour masquer le badge Crawlers.fr
- Les paramètres de branding sont appliqués à la génération du rapport

**Dashboard Admin :**
- Lancement de jobs, suivi de progression temps réel, suppression persistante
- Collecte de données d'entraînement ML : scores structurés et signaux techniques bruts

---

## 4. Crédits & Abonnement

### Comment fonctionnent les crédits ?
Les crédits (CreditCoin) sont la monnaie interne de Crawlers.fr pour les fonctionnalités premium ponctuelles.

À l'inscription : 20 crédits offerts.

Coût des actions principales :
- Audit Stratégique IA : 1 crédit
- Audit Comparé : 4 crédits
- Crawl (par tranche de 50 pages) : 1 crédit
- Architecte Génératif : 1 crédit

### Quelle est la différence entre Freemium, Pro Agency et Pro Agency + ?

| Feature | Freemium | Pro Agency | Pro Agency + |
|---|---|---|---|
| Bots IA, GEO Score, LLM, PageSpeed | ✅ | ✅ | ✅ |
| Audit Expert SEO | 1/jour | Illimité | Illimité |
| Audit Stratégique IA | Crédits | Crédits | Crédits |
| Cocon Sémantique 3D + Stratégie 360° | ❌ | ✅ | ✅ |
| Crawl multi-pages | ❌ | 5 000 pages/mois | 50 000 pages/mois |
| Tracking SERP/GSC/GA4 | ❌ | ✅ | ✅ |
| Agents autonomes | ❌ | ✅ | ✅ |
| Content Architect + Calendrier éditorial | ❌ | ✅ | ✅ |
| Sites simultanés | 1 | 30 | 30 |
| Quiz IA intégrés | ✅ (Crawlers) | ✅ (tous) | ✅ (tous) |
| Prix | Gratuit | à partir de 29€/mois* | 99€/mois |

*Offre de lancement garantie à vie pour les 100 premiers abonnés. Prochain palier : 99€/mois.

### Qu'est-ce que le plan Pro Agency + ?
Le plan Pro Agency + (99€/mois) est le plan premium de Crawlers.fr. Il inclut toutes les fonctionnalités de Pro Agency avec un quota de crawl étendu à 50 000 pages par mois (au lieu de 5 000), et un slider de crawl étendu jusqu'à 50 pages par analyse (au lieu de 20). Ce plan est conçu pour les agences gérant de grands sites ou un portefeuille étendu de clients.

### Comment fonctionne l'offre early adopter ?
Les 100 premiers abonnés Pro Agency bénéficient du tarif 29€/mois garanti à vie — même quand le prix public passera à 99€/mois.

Ce tarif est nominatif, lié à votre compte, et non transférable.

### Comment acheter des crédits ?
Depuis votre tableau de bord > section Crédits :
- Pack ponctuel : à l'unité selon le barème
- Pack Ultime : 500 crédits pour 99€ (one-shot)
- Bundle APIs : accès APIs tierces selon volume

Paiement sécurisé via Stripe. Facturation immédiate, crédits disponibles instantanément.

### Comment résilier ?
Depuis votre tableau de bord > Abonnement > Résilier. La résiliation prend effet à la fin de la période en cours. Vos données sont conservées 30 jours après résiliation.

---

## 5. Assistants IA intégrés

### Félix — Assistant personnel
Félix est l'assistant IA intégré, disponible sur toutes les pages via la bulle violette en bas à droite. Accessible à tous les utilisateurs, même non inscrits.

**Personnalité :** collègue sympa et spécialiste. Ton décontracté mais précis, réponses courtes et directes. Félix adapte automatiquement la longueur et la technicité de ses réponses au profil de l'utilisateur (persona) et à son score de connaissances SEO/GEO.

**Fonctionnalités :**
- Lecture contextuelle de l'écran en temps réel
- Explication des scores SEO, GEO et E-E-A-T
- Recherche Google en temps réel (SERP, positions, avis)
- Guide interactif : demande à l'utilisateur de scroller pour analyser davantage
- Détection des questions récurrentes et suggestion de quiz
- Signalement de bugs via bouton dédié
- Upload d'images/documents via le bouton photo (ouvre le sélecteur de fichiers natif du système)

**Workflow post-audit :**
Après un audit (Expert ou Matrice), si Félix est en mode fenêtre toute hauteur, il propose automatiquement :
1. « Veux-tu que je te résume les résultats de cet audit ? » → résumé général bref
2. Classement des problèmes par priorité (haute, moyenne, basse)
3. « Par quoi veux-tu qu'on commence ? » avec 3 boutons de priorité
4. Au clic : lecture du Workbench et présentation des solutions proposées
5. Proposition d'action : « Veux-tu que j'ouvre Content Architect / Code Architect ? » (Oui / Non)
6. Si non : « Veux-tu que je mette à jour le plan d'action ? » → mise à jour dans /console
7. Si non : « Tu peux revenir plus tard via l'historique (picto horloge) »

**Quiz intégrés :** Félix propose trois types de quiz :
- **Quiz SEO/GEO** (20 questions) : testez vos connaissances en référencement naturel et optimisation IA
- **Quiz Crawlers** (20 questions) : apprenez à maîtriser les outils de la plateforme
- Le quiz Crawlers est suggéré automatiquement sur la page d'accueil 5 secondes après la première visite, même pour les utilisateurs non inscrits
- Si Félix détecte 3+ questions sur les outils Crawlers dans une session, il propose : « Tu as beaucoup de questions sur les outils Crawlers ! On peut faire un quiz en 2 min si tu veux » avec deux boutons : « D'accord ! » (lance le quiz) et « Plus tard. » (Félix répond « Entendu ! En quoi puis-je t'aider ? »)
- Tous les quiz sont disponibles en français, anglais et espagnol
- Les bonnes réponses sont réparties aléatoirement entre les options A, B, C, D (pas toujours en A)
- Les mauvaises réponses ont un nombre de caractères équivalent à la bonne réponse pour éviter les biais visuels

### Stratège Cocoon — Consultant SEO senior
Le Stratège Cocoon est l'IA du module Cocon Sémantique, réservé aux abonnés Pro Agency.

**Personnalité :** consultant externe senior, cordial et pédagogue. Il donne des recommandations précises et actionnable tout en restant respectueux — l'utilisateur est son client. Il navigue entre la confiance en son expertise et l'amabilité de la relation commerciale. Il adapte le ton et la longueur de ses réponses au persona de l'utilisateur et à son score de connaissances SEO/GEO.

**Fonctionnalités :**
- Diagnostic du maillage interne et pages orphelines
- Prescriptions concrètes : contenus, liens, architecture
- Mémoire persistante entre sessions — s'améliore avec le temps
- Suivi d'impact T+30 / T+60 / T+90 via GSC & GA4
- Lancement de la Stratégie 360°

**Quiz Cocoon** (50 questions) :
- 30 questions sur le maillage, la cannibalisation, le gap, le juice, le pruning, le ranking interne, les backlinks et les solutions à ces problématiques
- 20 questions sur Cocoon, Stratège Cocoon et Content Architect (fonctionnement et objectifs)
- Suggéré automatiquement si l'utilisateur est novice sur Cocoon, si son score de connaissances est faible, ou si Stratège Cocoon détecte beaucoup de questions et d'incompréhension
- Bouton « Question suivante » sur fond jaune d'or (cohérent avec l'identité visuelle Stratège Cocoon)
- Disponible en français, anglais et espagnol

---

## 6. Problèmes fréquents & solutions

### Mon audit est bloqué ou ne se termine pas
- Attendez 5 minutes — les audits complexes peuvent prendre jusqu'à 5 minutes
- Rafraîchissez la page et consultez le tableau de bord — le résultat peut être disponible sans notification
- Si le problème persiste après 10 minutes, relancez un nouvel audit
- Les sites avec JavaScript heavy ou protections anti-bot peuvent allonger le temps de traitement

### GSC, GA4 ou GBP ne se connectent pas
- Vérifiez que vous utilisez le bon compte Google (celui qui a accès à la propriété ou à l'établissement)
- Acceptez tous les scopes OAuth demandés (ne décochez aucune permission)
- Vérifiez que votre site est bien vérifié dans Google Search Console
- **Pour GBP :** la connexion GBP utilise un flux OAuth **séparé** de GSC/GA4. Cliquez sur "Connecter Google Business" dans l'onglet GMB de la Console (et non dans la connexion GSC)
- Pour GBP : vérifiez que vous êtes propriétaire ou gestionnaire de la fiche dans Google Business Profile
- Déconnectez et reconnectez le compte Google depuis votre tableau de bord
- Si l'erreur persiste, essayez avec un autre navigateur ou en navigation privée

### Mon score GEO est très bas, pourquoi ?
Les causes les plus fréquentes :
- Absence de données structurées JSON-LD
- Contenu trop générique sans expertise thématique claire
- Site bloqué pour les bots IA dans robots.txt (GPTBot, ClaudeBot, PerplexityBot)
- Absence de page À propos ou mentions légales (signaux E-E-A-T faibles)
- Contenu trop court ou trop peu fréquent

Utilisez l'Architecte Génératif pour générer les correctifs JSON-LD adaptés à votre situation.

### La Stratégie 360° ne se lance pas
- Vérifiez qu'un crawl multi-pages a été réalisé sur votre site (requis pour le diagnostic)
- Le Cocon Sémantique doit avoir été généré au moins une fois
- Assurez-vous d'être sur la page /cocoon avec le bon site sélectionné
- Le bouton boussole se trouve dans le chat du Stratège Cocoon

### Je ne vois pas mes données GSC dans le tableau de bord
- Les données GSC sont importées après connexion — patientez 5 à 10 minutes
- Google Search Console ne fournit des données qu'à partir de 28 jours d'historique minimum
- Vérifiez que la propriété sélectionnée est la bonne (www vs non-www, http vs https)

### L'Architecte Génératif génère du code incorrect
- Vérifiez que l'URL analysée est bien accessible publiquement
- Certains CMS propriétaires peuvent nécessiter des ajustements manuels du code généré
- Testez le code généré avec l'outil Rich Results Test de Google avant déploiement
- En cas de doute, utilisez l'injection GTM plutôt que l'injection directe

### Mon quota de crawl est atteint
- Le quota de crawl dépend de votre plan : 5 000 pages/mois (Pro Agency) ou 50 000 pages/mois (Pro Agency +)
- Si le quota est atteint, le bouton de lancement vibre et une modal propose le Pack Ultime (500 crédits / 99€)
- Les crédits de crawl sont réinitialisés à chaque période de facturation
- Vous pouvez passer au plan Pro Agency + pour un quota de 50 000 pages/mois

### Je veux supprimer mon compte
Tableau de bord > Paramètres > Supprimer mon compte. La suppression est définitive et conforme au RGPD. Vos données sont effacées sous 72 heures.

---

## 7. Sécurité & Confidentialité

### Où sont hébergées mes données ?
Crawlers.fr héberge toutes ses données en Europe. Aucune donnée n'est stockée aux États-Unis.

### Crawlers.fr est-il conforme au RGPD ?
Oui. Crawlers.fr est RGPD natif :
- Droit à l'effacement : suppression de compte disponible depuis le tableau de bord
- Droit à la portabilité : export de vos données disponible sur demande
- Pas de revente de données à des tiers
- Politique de confidentialité complète : https://crawlers.fr/politique-confidentialite

### Mes tokens Google sont-ils sécurisés ?
Oui. Les tokens OAuth Google sont stockés de manière chiffrée avec isolation par utilisateur — ils ne sont jamais exposés côté client ni accessibles par d'autres utilisateurs.

### Crawlers.fr vend-il mes données ?
Non. Vos données (site, scores, historiques) sont strictement personnelles et ne sont jamais revendues ni partagées avec des tiers.

---

## 8. Intégration technique

### Comment intégrer le SDK Crawlers ?
Trois méthodes sont disponibles pour brancher votre site à Crawlers.AI, accessibles depuis Console → Mes Sites → icône 🔌 :

**CMS supportés** : WordPress, Shopify, Wix, PrestaShop, Drupal (sélection par logo-bouton dans la modale).

### Méthode 1 : API CMS (recommandé)
Connexion directe via l'API REST de votre CMS (WordPress, Shopify, Wix, PrestaShop, Drupal).
1. Ouvrez la modale « Brancher mon site »
2. Sélectionnez votre CMS via le logo correspondant
3. Entrez l'URL de votre site
4. Cliquez sur « Lien Magique » — un onglet s'ouvre sur votre admin pour valider automatiquement la connexion

### Méthode 2 : Plugin WordPress (.zip)
Installation classique avec synchronisation automatique toutes les 6h via WP Cron.
1. Depuis la modale, cliquez sur « Télécharger le Plugin .zip »
2. Dans WordPress → Extensions → Ajouter → Téléverser → Activez
3. Le plugin interroge l'API toutes les 6h et injecte les correctifs via wp_head/wp_footer

### Méthode 3 : Google Tag Manager / Script universel
Snippet léger (~2 Ko) compatible tous CMS et sites custom.
1. Copiez le snippet pré-rempli avec votre clé API
2. Option A : Déploiement 1-clic via l'API GTM (connectez votre compte Google)
3. Option B : Nouvelle balise GTM → HTML personnalisée → Collez → Déclencheur All Pages → Publiez
4. Option C : Collez directement avant </head> dans votre code source

Guide complet : https://crawlers.fr/integration-gtm

### Compatible avec WordPress ?
Oui. Crawlers.fr propose trois niveaux d'intégration WordPress : API CMS via Lien Magique, plugin .zip classique, et snippet GTM/Script universel. Les codes correctifs sont compatibles avec Elementor, Divi, Astra, GeneratePress et tous les thèmes majeurs. Le système supporte également Shopify, Wix, PrestaShop et Drupal.

---

## 9. Intégration MCP (Claude & IA)

### Qu'est-ce que le serveur MCP Crawlers ?
Crawlers.fr expose ses outils d'audit SEO/GEO comme un serveur MCP (Model Context Protocol) compatible avec Claude et tout client MCP. Cela permet à Claude d'appeler directement les outils Crawlers pour auditer un site, vérifier sa visibilité IA, générer du code correctif et mesurer l'impact — le tout en langage naturel.

Endpoint : `POST https://api.crawlers.fr/functions/v1/mcp-server`

### Outils MCP gratuits (sans authentification)
- **check_geo_score** : Score GEO (0-100) pour l'optimisation moteurs IA
- **check_llm_visibility** : Visibilité sur ChatGPT, Gemini, Perplexity, Claude, Mistral, Llama
- **check_ai_crawlers** : Analyse des bots IA (GPTBot, ClaudeBot, Google-Extended)

### Outils MCP Pro Agency (token requis)
- **expert_seo_audit** : Audit SEO 200 points
- **strategic_ai_audit** : Audit stratégique IA multi-axes
- **generate_corrective_code** : Génération de code correctif JS
- **dry_run_script** : Test sandbox avant déploiement
- **calculate_cocoon_logic** : Cocon sémantique TF-IDF
- **measure_audit_impact** : Mesure d'impact T+30/T+60/T+90
- **wordpress_sync** : Injection correctifs WordPress
- **fetch_serp_kpis** : KPIs SERP hebdomadaires
- **calculate_ias** : Indice d'Alignement Stratégique

Authentification : token Supabase d'un compte Pro Agency. Rate limit : 30 appels/heure.

### Comment utiliser le MCP avec Claude ?
1. Configurez le serveur MCP dans votre client Claude avec l'endpoint Crawlers
2. Claude découvre automatiquement les 12 outils disponibles
3. Demandez en langage naturel : « Audite le site example.com »
4. Claude appelle les outils Crawlers et synthétise les résultats

Pour les outils Pro, votre token d'authentification Crawlers est transmis automatiquement.

---

## 10. Infrastructure & Monitoring

### Suivi des coûts API en temps réel
Le module Finances du dashboard admin agrège les soldes et consommations en temps réel de toutes les APIs tierces :
- **DataForSEO** : solde en dollars, alertes automatiques quand le solde passe sous $5
- **SerpAPI** : recherches restantes sur le plan mensuel
- **OpenRouter** : consommation IA en dollars vs limite du compte
- **Firecrawl** : crédits de crawl restants vs total alloué

Des alertes visuelles (critique, bas, sain) et des notifications Felix sont envoyées aux admins en cas de solde critique.

### Fallback API automatique
En cas d'épuisement des crédits DataForSEO (erreur 402), le système bascule automatiquement sur SerpAPI pour les requêtes SERP, assurant la continuité de service sans intervention manuelle.

### Ahrefs Firehose API
Intégration de l'API Firehose d'Ahrefs pour le suivi des backlinks en temps réel. Endpoint dédié pour interroger le flux de données backlinks.

---

## 11. À propos de Crawlers.fr

### Qu'est-ce que Crawlers.fr ?
Crawlers.fr est la première plateforme européenne combinant audit SEO technique, GEO (Generative Engine Optimization), visibilité LLM et génération de correctifs actionnables dans un seul outil. Lancée en mars 2026, elle s'adresse aux agences SEO, freelances et PME.

### Crawlers.fr est-il un wrapper GPT ?
Non. Crawlers.fr est une infrastructure serverless de plus de 260 000 lignes de code, avec 15 algorithmes propriétaires, 216 Edge Functions, un système multi-fallback sur toutes les APIs critiques, et une architecture RGPD native. Ce n'est pas un wrapper IA.

### Quels LLMs Crawlers.fr interroge-t-il ?
6 LLMs interrogés en parallèle : ChatGPT (OpenAI), Gemini (Google), Perplexity, Claude (Anthropic), Mistral et Llama (Meta).

### Comment signaler un bug ou un problème ?
Depuis le chat de l'assistant Félix ou du Stratège Cocoon, mentionnez simplement votre problème (ex : "j'ai un bug", "ça ne marche pas"). L'assistant vous proposera un bouton "Signaler un problème". Votre signalement sera transmis à l'équipe technique et vous serez notifié dès qu'il est résolu.

### Comment contacter le support ?
Via le chat in-app disponible sur toutes les pages de l'interface (icône en bas à droite). L'agent IA répond 24h/24. Les questions complexes sont escaladées au fondateur sous 24h ouvrées.
