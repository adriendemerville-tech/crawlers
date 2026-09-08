# Offre unique « Audit + correctifs » — plan d'implantation

Produit : un achat unique. Audit du site et de la fiche Google Maps, correctifs proposés, 3 contenus rédigés et validés par le client, optimisation de la fiche Google Maps. **Rien n'est déployé avant paiement.**

## Le parcours, une seule URL, aucun choix

```text
/passe-visibilite
1. Adresse du site        -> analyse gratuite affichée
2. Inscription            -> le résultat est rattaché au compte
3. Diagnostic             -> problèmes classés, sans jargon
4. Correctifs proposés    -> liste figée
5. 3 contenus rédigés     -> relecture et corrections du client, puis validation
6. Connexions             -> son site + sa fiche Google Maps
7. Récapitulatif + paiement
8. Déploiement            -> site et fiche Google Maps
9. Compte rendu           -> avant / après
```

Une étape visible à la fois, un seul bouton, reprise possible là où le client s'est arrêté.

## Étapes d'implantation

### Étape 1 — La commande en base
Une table `passe_orders` : une ligne par client, l'étape en cours, le site, la fiche Google Maps visée, les problèmes retenus, les 3 contenus et leur statut de validation, `paid_at`, `deployed_at`, le compte rendu. Isolation par `auth.uid()`, droits explicites, accès complet pour les traitements serveur.
Tables filles : `passe_order_contents` (un contenu = une ligne, versions successives de relecture) et `passe_order_events` (journal : créé, validé, payé, déployé, échec).

### Étape 2 — Le diagnostic réutilisé
Aucune nouvelle analyse : on branche l'audit existant du site et le diagnostic de fiche Google Maps déjà en place, et on n'en garde que les 6 à 10 problèmes réellement corrigeables par cette offre. Le reste est présenté comme « inclus dans le suivi mensuel ».

### Étape 3 — Les 3 contenus
Rédaction via la chaîne éditoriale existante, en brouillon. Génération unique par contenu, mise en cache ; les corrections du client sont appliquées sans nouvelle génération complète. Deux allers-retours inclus, puis validation ferme.

### Étape 4 — Les connexions
Site : connexion existante (WordPress, Shopify, Webflow, Wix, etc.). Fiche Google Maps : autorisation Google déjà gérée. Si l'une des deux est impossible, l'étape le dit clairement et propose la livraison en fichiers plutôt que la publication.

### Étape 5 — L'écriture sur la fiche Google Maps (à construire)
Aujourd'hui on lit la fiche, les avis, les publications, et on répond aux avis. À ajouter : mise à jour de la description, des catégories, des horaires et du site web, et création d'une publication. Avec aperçu avant / après et journal de ce qui a été modifié.

### Étape 6 — Paiement et verrou
Paiement unique. La confirmation vient exclusivement du prestataire de paiement, jamais du navigateur. Le déploiement refuse de démarrer si `paid_at` est vide. Après paiement, remboursement possible selon la politique en place tant que le déploiement n'a pas eu lieu.

### Étape 7 — Déploiement et compte rendu
Publication des 3 contenus, application des correctifs de la fiche Google Maps, instantané avant / après, compte rendu lisible : ce qui a été corrigé, ce qui a été publié, ce qui reste à faire, et proposition d'abonnement de suivi.

### Étape 8 — La page publique
Page dédiée, rendue côté serveur, mise en cache, sections basses en chargement différé, un seul titre principal, métadonnées propres, bloc de réponse directe, données structurées produit / offre, ajout au sitemap. Design noir et blanc, sans emoji, boutons à bordure.

### Étape 9 — Suivi interne
Un onglet d'administration : commandes en cours, étape bloquante, paiements, déploiements en échec, relance possible.

## Points à trancher avant de coder

- Le prix de la passe unique, et la remise éventuelle vers l'abonnement de suivi.
- Le délai annoncé entre paiement et déploiement.
- Le nombre de retouches incluses sur les contenus (proposition : deux).
- Cas sans fiche Google Maps ou site non connectable : offre dégradée à prix réduit, ou refus en amont.

## Détails techniques

- `passe_orders`, `passe_order_contents`, `passe_order_events` créées par migration, avec `GRANT` sur `authenticated` et `service_role`, RLS scopée `auth.uid()`, validations temporelles par déclencheur et non par contrainte.
- Verrou : la fonction de déploiement lit `paid_at` côté serveur avec le client de service ; le client ne peut jamais déclencher un déploiement.
- Paiement : réutilisation de la chaîne Paddle existante (`create-checkout`, `payments-webhook`) avec un prix ponctuel, filtrage systématique sur l'environnement.
- Google Maps : nouvelles actions dans `supabase/functions/gmb-actions` (`update-location-info`, `create-post`), jeton et rafraîchissement déjà gérés par `gbp-auth`, portée `business.manage`.
- Site : réutilisation de `cms-push-draft` et `cms-patch-content`, instantané dans `content_deploy_snapshots`.
- Diagnostic : réutilisation des fonctions d'audit existantes et de `gmb-optimization`, sans nouvelle dépense LLM avant l'étape 5.
- Page publique : route et page dédiées, ajout du chemin au cache HTML de `src/server.ts` et au sitemap.
