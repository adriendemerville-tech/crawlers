# Passe unique — délégation explicite de chaque correctif

Objectif : aucun correctif n'est appliqué sur le site du client sans une case cochée par lui, correctif par correctif, avec avant/après visible et possibilité d'annuler. Cela inclut les plus simples (titre, meta description, JSON-LD, redirection 301).

## Principe de délégation — une seule fois

1. L'audit produit la liste complète des correctifs proposés, chacun avec : ce qui est constaté, ce qui sera écrit, la page concernée, l'impact attendu.
2. Le client lit cette liste et donne **une seule autorisation**, une fois, pour l'ensemble. Pas de validation correctif par correctif, pas de relance à chaque déploiement.
3. Cette autorisation est horodatée et conservée comme preuve de consentement, avec la liste exacte des correctifs couverts.
4. Il peut, avant de valider, décocher les correctifs qu'il ne veut pas ; ce qui reste coché est déployé sans lui redemander.
5. Chaque correctif déployé garde son état d'avant, annulable en un clic à tout moment.
6. Ce que la plateforme ne peut pas appliquer sur son site est livré en mode « à copier », pas silencieusement ignoré.


## Liste des correctifs proposables

### 1. Balises et en-tête de page
- Titre de page (title)
- Meta description
- URL canonique
- Robots / indexation
- Open Graph et Twitter Cards
- Hreflang (sites multilingues)

### 2. Structure de contenu
- H1 unique et reformulé
- Hiérarchie H2 / H3 réordonnée
- Résumé d'en-tête en puces (réponse directe en tête de page)
- Fil d'Ariane visible
- Liens internes ajoutés vers les pages du même thème
- Bloc articles connexes

### 3. Contenus ajoutés pour la visibilité IA (GEO)
- Passage citable (bloc de réponse courte reprise par les IA)
- Section FAQ rédigée
- Tableau de données comparatif
- Section informative complémentaire
- Calque anti-hallucination (faits vérifiés sur l'entreprise)
- Trois articles rédigés (déjà dans la passe)

### 4. Données structurées
LocalBusiness, Organization, Service, Product/Offer, Article/BlogPosting, FAQPage, HowTo, BreadcrumbList, Review/AggregateRating, Person (E-E-A-T), Event, VideoObject, Speakable, SearchAction, SiteNavigation.

### 5. Images
- Ajout des textes alternatifs manquants
- Conversion au format moderne (WebP/AVIF) et recompression
- Largeur/hauteur déclarées (évite les sauts de mise en page)
- Chargement différé des images hors écran
- Priorité de chargement sur l'image principale

### 6. Vitesse et LCP
- Préchargement de l'image ou de la police principale
- CSS critique en ligne
- Affichage immédiat des polices (font-display)
- Réduction du poids de l'image principale
Limite : les correctifs de vitesse qui dépendent du thème, du serveur ou des extensions sont livrés en recommandation chiffrée, pas appliqués.

### 7. Fichiers racine
robots.txt, sitemap.xml, llms.txt / llms-full.txt, security.txt, ads.txt.

### 8. Redirections et propreté d'URL
- Redirections 301 sur les pages cassées ou dupliquées
- Consolidation de deux pages qui se cannibalisent

### 9. Fiche Google Maps
Catégories, description, horaires, publications, réponses aux avis.

## Ce qui reste hors délégation automatique
Suppression de contenu existant, changement d'URL d'une page qui reçoit du trafic, modification du thème ou du code serveur, achat de liens. Ces points sont signalés mais jamais exécutés par la plateforme.

## Détails techniques
- Nouvelle table de registre des correctifs de la passe : commande, page, type (référence au catalogue d'injections existant, 39 entrées), charge utile générée, état avant, statut (proposé / autorisé / déployé / annulé / non applicable), identifiant de retour.
- Une table de consentement par commande : horodatage unique, liste des correctifs couverts, version du récapitulatif affiché. Le déploiement lit ce consentement et n'interroge plus l'utilisateur.
- Le déploiement de la passe branche, en plus de la publication d'articles et de la fiche Maps, les canaux de correctif de contenu, de code et de redirection déjà présents côté serveur.
- Chaque type de correctif déclare les capacités CMS requises ; s'il manque une capacité, le correctif passe en « à copier » avec le code fourni.
- Écran unique de délégation dans le parcours de la passe : liste groupée par famille, avant/après, décochage possible, une validation, puis suivi de déploiement en lecture seule.

