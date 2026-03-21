---
title: "Documentation SAV Crawlers.fr"
version: "1.0"
date: "2026-03-21"
usage: "Base de connaissance agent Limova + documentation publique /aide"
confidentialite: "Public"
---

# Centre d'aide Crawlers.fr

## 1. Démarrer avec Crawlers.fr

### Créer son compte
Rendez-vous sur https://crawlers.fr/signup.
L'inscription est gratuite et débloque :
- L'audit technique SEO 200 points (1 par jour)
- 25 crédits offerts dès l'inscription
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

Disponible : 1 fois par jour en freemium inscrit. Illimité en Pro Agency.

### Audit Stratégique IA
Analyse approfondie multi-axes avec scoring IA :
- Score IAS (23 variables)
- Analyse E-E-A-T
- Recommandations prioritaires classées par impact
- Génération de plan d'action

Coût : 1 crédit.

### Audit Comparé
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

### Audit Matrice de Prompts
Test de votre visibilité sur des prompts cibles dans plusieurs LLMs simultanément :
- Définissez vos prompts cibles (ex : "meilleure agence SEO Paris")
- Crawlers interroge ChatGPT, Gemini, Perplexity, Claude
- Résultats : taux de citation, sentiment, position dans la réponse

### Cocon Sémantique 3D
Visualisation interactive de l'architecture sémantique de votre site en 3D (Three.js) :
- Clusters thématiques calculés via TF-IDF
- Liens internes visualisés et analysés
- Recommandations de maillage automatiques
- Chat IA intégré pour affiner la stratégie
- Export et persistance des sessions

Disponible en Pro Agency.

### Architecte Génératif
Génération automatique de codes correctifs multi-pages :
- JSON-LD (SoftwareApplication, Organization, FAQPage, BreadcrumbList...)
- Balises meta optimisées
- Attributs de maillage interne
- Intégration directe : WordPress, GTM ou SDK

Coût : 1 crédit.

### Crawl Multi-Pages
Analyse récursive de votre site :
- Jusqu'à 5000 pages par crawl
- Détection d'erreurs techniques page par page
- Analyse du maillage interne
- Rapport exportable

Disponible en Pro Agency (inclus dans l'abonnement).

### Tracking SERP
Suivi hebdomadaire de vos positions Google :
- Mots-clés trackés et leurs évolutions
- Historique des positions dans le temps
- Détection des Quick Wins (positions 4-10)
- Données via DataForSEO avec fallback SerpAPI

### Agents Autonomes
- Agent SEO : optimisation automatique du contenu (blog : libre, landing pages : max 10% de modification)
- Agent CTO : maintenance algorithmique automatique, self-critique et proposition de patches

---

## 4. Crédits & Abonnement

### Comment fonctionnent les crédits ?
Les crédits (CreditCoin) sont la monnaie interne de Crawlers.fr pour les fonctionnalités premium ponctuelles.

À l'inscription : 25 crédits offerts.

Coût des actions principales :
- Audit Stratégique IA : 1 crédit
- Audit Comparé : 4 crédits
- Crawl (par tranche de 50 pages) : 1 crédit
- Architecte Génératif : 1 crédit

### Quelle est la différence entre Freemium et Pro Agency ?

| Feature | Freemium | Pro Agency |
|---|---|---|
| Bots IA, GEO Score, LLM, PageSpeed | ✅ | ✅ |
| Audit Expert SEO | 1/jour | Illimité |
| Audit Stratégique IA | Crédits | Crédits |
| Cocon Sémantique 3D | ❌ | ✅ |
| Crawl multi-pages | ❌ | ✅ |
| Tracking SERP/GSC/GA4 | ❌ | ✅ |
| Agents autonomes | ❌ | ✅ |
| Sites simultanés | 1 | 30 |
| Prix | Gratuit | 59€/mois* |

*Offre de lancement garantie à vie pour les 100 premiers abonnés. Prochain palier : 99€/mois.

### Comment fonctionne l'offre early adopter ?
Les 100 premiers abonnés Pro Agency bénéficient du tarif 59€/mois garanti à vie — même quand le prix public passera à 99€/mois.

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

## 5. Problèmes fréquents & solutions

### Mon audit est bloqué ou ne se termine pas
- Attendez 5 minutes — les audits complexes peuvent prendre jusqu'à 5 minutes
- Rafraîchissez la page et consultez le tableau de bord — le résultat peut être disponible sans notification
- Si le problème persiste après 10 minutes, relancez un nouvel audit
- Les sites avec JavaScript heavy ou protections anti-bot peuvent allonger le temps de traitement

### GSC ou GA4 ne se connectent pas
- Vérifiez que vous utilisez le bon compte Google (celui qui a accès à la propriété)
- Acceptez tous les scopes OAuth demandés (ne décochez aucune permission)
- Vérifiez que votre site est bien vérifié dans Google Search Console
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

### Je ne vois pas mes données GSC dans le tableau de bord
- Les données GSC sont importées après connexion — patientez 5 à 10 minutes
- Google Search Console ne fournit des données qu'à partir de 28 jours d'historique minimum
- Vérifiez que la propriété sélectionnée est la bonne (www vs non-www, http vs https)

### L'Architecte Génératif génère du code incorrect
- Vérifiez que l'URL analysée est bien accessible publiquement
- Certains CMS propriétaires peuvent nécessiter des ajustements manuels du code généré
- Testez le code généré avec l'outil Rich Results Test de Google avant déploiement
- En cas de doute, utilisez l'injection GTM plutôt que l'injection directe

### Je veux supprimer mon compte
Tableau de bord > Paramètres > Supprimer mon compte. La suppression est définitive et conforme au RGPD. Vos données sont effacées sous 72 heures.

---

## 6. Sécurité & Confidentialité

### Où sont hébergées mes données ?
Crawlers.fr héberge toutes ses données en Europe. Aucune donnée n'est stockée aux États-Unis.

### Crawlers.fr est-il conforme au RGPD ?
Oui. Crawlers.fr est RGPD natif :
- Droit à l'effacement : suppression de compte disponible depuis le tableau de bord
- Droit à la portabilité : export de vos données disponible sur demande
- Pas de revente de données à des tiers
- Politique de confidentialité complète : https://crawlers.fr/politique-confidentialite

### Mes tokens Google sont-ils sécurisés ?
Oui. Les tokens OAuth Google sont stockés de manière chiffrée avec Row-Level Security — ils ne sont jamais exposés côté client ni accessibles par d'autres utilisateurs.

### Crawlers.fr vend-il mes données ?
Non. Vos données (site, scores, historiques) sont strictement personnelles et ne sont jamais revendues ni partagées avec des tiers.

---

## 7. Intégration technique

### Comment intégrer le SDK Crawlers ?
Le SDK Crawlers permet d'injecter des correctifs directement sur votre site sans modifier le code source :
1. Depuis tableau de bord > Intégration SDK
2. Copiez le snippet JavaScript fourni
3. Collez-le avant </head> sur toutes vos pages
4. Les correctifs sont déployés et mis à jour automatiquement

### Comment intégrer via Google Tag Manager ?
1. Depuis tableau de bord > Intégration GTM
2. Copiez l'ID de tag fourni
3. Dans GTM, créez une balise HTML personnalisée
4. Collez le code et configurez le déclencheur "Toutes les pages"
5. Publiez le conteneur GTM

### Compatible avec WordPress ?
Oui. Crawlers.fr propose un scanner WordPress natif (plugins, thèmes, sécurité) et une intégration directe. Les codes correctifs générés par l'Architecte Génératif sont compatibles avec les principaux thèmes WordPress (Elementor, Divi, Astra, GeneratePress).

---

## 8. À propos de Crawlers.fr

### Qu'est-ce que Crawlers.fr ?
Crawlers.fr est la première plateforme francophone combinant audit SEO technique, GEO Score, visibilité LLM et génération de correctifs actionnables dans un seul outil. Lancée en mars 2026, elle s'adresse aux agences SEO, freelances et PME.

### Crawlers.fr est-il un wrapper GPT ?
Non. Crawlers.fr est une infrastructure serverless de plus de 150 000 lignes de code, avec 7 algorithmes propriétaires, un système multi-fallback sur toutes les APIs critiques, et une architecture RGPD native. Ce n'est pas un wrapper IA.

### Quels LLMs Crawlers.fr interroge-t-il ?
ChatGPT (OpenAI), Gemini (Google), Perplexity et Claude (Anthropic) — en interrogation parallèle simultanée, pas séquentielle.

### Comment contacter le support ?
Via le chat in-app disponible sur toutes les pages de l'interface (icône en bas à droite). L'agent IA répond 24h/24. Les questions complexes sont escaladées au fondateur sous 24h ouvrées.
