# Parmenion 59 € — plan pour finir l'implémentation

Objectif : rendre le parcours livrable de bout en bout, en réutilisant les briques existantes (audit expert, workbench, chaîne éditoriale, autorisation Google, connexions CMS, paiement Paddle). Aucun nouveau moteur.

## Principes verrouillés

- Une seule URL, une étape visible à la fois, reprise là où le client s'est arrêté.
- Aucun déploiement avant paiement ; le verrou est lu côté serveur uniquement.
- Le client valide chaque contenu avant paiement ; 2 allers-retours maximum.
- Fiche Google Maps : aperçu avant / après validé, puis journal de chaque champ modifié.
- Dépense IA repoussée le plus tard possible : diagnostic déterministe, contenus générés une seule fois puis mis en cache.

## Lot 1 — Diagnostic réel (remplace le faux délai)

- Appel de l'audit existant sur l'URL saisie + score de la fiche Google Maps quand une fiche est trouvée.
- Filtre vers 6 à 10 constats corrigeables, classés par impact, formulés sans jargon.
- Écriture dans `passe_orders.findings`, avancement `step`, journal dans `passe_order_events`.
- Version gratuite sans compte : quota serveur par IP / e-mail comme Marina ; le détail n'apparaît qu'après inscription.

## Lot 2 — Correctifs proposés (étape 4)

- Liste figée des correctifs déduits des constats, avec avant / après lisible par un dirigeant.
- Périmètre borné et affiché : titres, descriptions, données structurées, contenu de page, liens internes, publication des 3 pages, champs de la fiche Google Maps. Ce qui relève du thème est signalé en recommandation, pas promis.

## Lot 3 — Les 3 contenus avec validation (étape 5)

- Sujets proposés par le moteur à partir du diagnostic, présentés pour accord.
- Génération unique via la chaîne éditoriale existante, stockée dans `passe_order_contents` (brouillon, version révisée, compteur).
- Relecture client : corrections ciblées sans régénération complète, 2 allers-retours, puis validation ferme qui verrouille le contenu.

## Lot 4 — Connexions (étape 6)

- Site : réutilisation des connexions CMS existantes ; test d'écriture à blanc avant de continuer.
- Fiche Google Maps : autorisation Google déjà en place ; sélection de la fiche, ou parcours guidé de création si aucune fiche.
- Enregistrement de la cible dans `passe_orders` (`gmb_location_id`, `gmb_account_id`).

## Lot 5 — Récapitulatif, paiement, verrou

- Récapitulatif final : correctifs, 3 contenus validés, changements de fiche, prix, délai, garantie.
- Paiement existant conservé ; le passage à « payée » reste exclusivement déclenché par le webhook signé.
- Toute action de déploiement vérifie le paiement côté serveur avant d'agir.

## Lot 6 — Déploiement et journal

- Site : publication via les fonctions CMS existantes, instantané avant / après, réversible.
- Fiche Google Maps : nouvelles écritures (description, catégories, horaires, site web, publication), aperçu validé, un événement journalisé par champ.
- Reprise en cas d'échec partiel : chaque élément est déployé indépendamment et rejouable.

## Lot 7 — Espace de commande et compte rendu

- Espace client : état de la commande, étape en cours, reprise, historique des événements.
- Compte rendu final avant / après lisible, puis proposition de suivi mensuel.

## Lot 8 — Administration et finitions

- Onglet d'administration : commandes, étape bloquante, échecs de déploiement, relance manuelle.
- Fin du renommage Périclès (orchestrateur, agent SAV) — indépendant de cette offre.

## Détails techniques

- Server functions dans `src/lib/parmenion/parmenion.functions.ts` (+ helpers `.server.ts`) : `runPasseDiagnostic`, `proposePasseFixes`, `generatePasseContents`, `revisePasseContent`, `approvePasseContent`, `linkPasseTargets`, `deployPasseOrder`, `getPasseOrder`. Toutes sous `requireSupabaseAuth` sauf le diagnostic public à quota.
- Réutilisation : `audit-expert-seo`, `gmb-optimization`, `editorial-pipeline-run`, `cms-push-draft` / `cms-publish-draft` / `cms-patch-content`, autorisation Google existante.
- Nouvelles actions dans `gmb-actions` : `update-location-info`, `create-post` (portée `business.manage` déjà gérée).
- Migration additive : colonnes de suivi de déploiement sur `passe_orders` (`site_deploy_status`, `gmb_deploy_status`, `snapshot_id`), index `(user_id, status)`, GRANT `authenticated` / `service_role`, RLS `auth.uid()`.
- Journal : un enregistrement `passe_order_events` par transition et par champ Google Maps modifié.
- Front : `/passe-visibilite` en machine à états d'étapes, un seul bouton visible, palette violet / or / noir / blanc, boutons à bordure sans fond, aucun emoji.

## Ordre d'exécution proposé

Lot 1 → Lot 2 → Lot 3 → Lot 4 → Lot 5 → Lot 6 → Lot 7 → Lot 8.

## Reste à trancher

- Délai annoncé entre paiement et déploiement (proposition : 72 h).
- Garantie après déploiement (avant déploiement : remboursement intégral).
- Remise éventuelle vers l'abonnement de suivi dans le compte rendu.
