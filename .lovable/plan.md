# Offre « Débug + correctifs » en une fois — parcours vertical

## Réponse courte

Oui, c'est faisable, et la majorité des briques existent déjà : audit du site (Marina / audit expert), diagnostic Google Maps avec score et recommandations, génération d'articles, connexion au site (CMS) et à Google Maps, paiement à l'unité. Deux briques manquent réellement et doivent être construites : **l'écriture sur la fiche Google Maps** (aujourd'hui on sait lire la fiche, les avis, les publications, et répondre aux avis — pas modifier la description ni publier) et **le séquenceur de commande** qui bloque tout déploiement avant paiement.

## L'offre proposée

Prix unique, une passe complète :
- audit du site et de la fiche Google Maps,
- liste des correctifs prioritaires,
- 3 pages de contenu rédigées et relues par le client,
- optimisation de la fiche Google Maps (description, catégories, horaires, 1 publication),
- déploiement uniquement après paiement.

## Le parcours, sans aucun choix

Une seule URL, une seule colonne, un seul bouton à chaque étape.

```text
1. Adresse du site         -> analyse gratuite visible immédiatement
2. Création de compte      -> le résultat est conservé
3. Diagnostic              -> problèmes classés, sans jargon
4. Correctifs proposés     -> liste figée, non modifiable
5. 3 contenus rédigés      -> lecture, correction, validation par le client
6. Connexions             -> son site + sa fiche Google Maps
7. Récapitulatif + paiement
8. Déploiement automatique -> site et fiche Google Maps
9. Compte rendu            -> avant / après
```

Rien n'est publié avant l'étape 8. Le client peut quitter et reprendre : chaque étape est enregistrée.

## Ce qui existe déjà

- Analyse d'un site sans compte, avec conservation du résultat après inscription.
- Diagnostic Google Maps : score de complétude, recommandations classées, idées de publications.
- Rédaction d'articles et de pages, avec relecture et correction avant publication.
- Connexion au site pour publier (WordPress, Shopify, Webflow, Wix, etc.).
- Paiement et facturation.
- Offre 12 mois gratuits pour les jeunes entreprises, réutilisable comme variante.

## Ce qui manque et doit être construit

1. **Publier sur la fiche Google Maps.** Aujourd'hui on lit la fiche et on répond aux avis, mais on ne modifie ni la description, ni les catégories, ni les horaires, et on ne publie pas de post. À ajouter, avec l'autorisation Google correspondante et un aperçu avant / après.
2. **La commande elle-même.** Un enregistrement unique qui suit l'avancement du client (étape en cours, contenus validés, connexions faites, paiement reçu, déploiement effectué), avec un verrou : aucun déploiement possible sans paiement confirmé.
3. **La page du parcours.** Une page dédiée, une étape visible à la fois, aucun menu, aucun choix de plan.
4. **Le compte rendu final.** Ce qui a été corrigé, ce qui a été publié, ce qui reste à faire.

## Points à trancher avant d'écrire le code

- Le prix de la passe unique, et s'il s'accompagne d'une remise sur l'abonnement de suivi.
- Ce qui se passe si le client n'a pas de fiche Google Maps, ou si son site n'est pas connectable : offre dégradée ou remboursement.
- Le nombre de retouches incluses sur les 3 contenus.
- Le délai annoncé entre paiement et déploiement.

## Détails techniques

- Nouvelle table de commande (une ligne par client), colonnes d'état par étape, `paid_at`, `deployed_at`, RLS sur `auth.uid()`, GRANT explicites.
- Verrou de déploiement côté serveur : la fonction de déploiement refuse si `paid_at` est nul. Le paiement est confirmé par le webhook du prestataire de paiement, jamais par le client.
- Écriture Google Maps : nouvelles actions dans `supabase/functions/gmb-actions` (mise à jour des informations de la fiche et création de publication), autorisation `business.manage` déjà gérée par `gbp-auth`.
- Publication site : réutilisation de `cms-push-draft` / `cms-patch-content`, avec instantané avant / après.
- Contenus : réutilisation de la chaîne éditoriale existante, en mode brouillon jusqu'à validation puis paiement.
- Page du parcours en rendu serveur, cache HTML, sections basses en chargement différé, un seul H1, métadonnées propres, données structurées `Product` / `Offer`.
- Aucune dépense LLM avant l'étape 5, et une seule génération par contenu, avec cache, pour maîtriser le coût.
