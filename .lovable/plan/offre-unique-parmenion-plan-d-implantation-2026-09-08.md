# Offre unique « Parmenion » — plan d'implantation

Produit : un achat unique à 59 € TTC. Audit du site et de la fiche Google Maps, correctifs proposés, 3 contenus rédigés et validés par le client, optimisation de la fiche Google Maps. **Rien n'est déployé avant paiement.** Le client relit et valide tout avant de payer ; la validation humaine sur le contenu est une règle projet (les agents ne touchent jamais le code sans validation, on applique la même règle aux publications client).

## Décisions déjà tranchées

- **Nom commercial : Parmenion.**
- **Prix unique : 59 € TTC.**

## Améliorations par rapport au plan v1

1. **Paiement à l'unité déjà existant : on réutilise le mécanisme du pass Marina 15 €** (transaction unique, confirmation exclusivement par webhook, pass à usage unique consommé côté serveur). Aucun nouveau mécanisme de paiement à inventer — juste un nouveau type de pass.
2. **Deux déploiements de nature différente sont distingués** : le site (publication réversible, instantané avant / après) et la fiche Google Maps (modification d'un bien Google du client — nécessite un aperçu validé ET un journal de chaque champ modifié, car Google peut rejeter ou suspendre une fiche).
3. **Le contenu de la page publique est défini** (voir § Contenu de la page) au lieu d'être laissé flou.
4. **Le cas « sans fiche Google Maps » est tranché** : l'étape de connexion propose la création de la fiche guidée plutôt qu'un blocage — c'est un service inclus, pas une exception.
5. **Le diagnostic gratuit reste gratuit sans compte** (comme Marina : quota serveur par IP/email), l'inscription n'intervient qu'au moment où le client veut voir ses correctifs détaillés.

## Le parcours, une seule URL, aucun choix

```text
/passe-visibilite
1. Adresse du site        -> analyse gratuite affichée (sans compte, quota serveur)
2. Inscription            -> uniquement pour débloquer le détail du diagnostic
3. Diagnostic             -> 6 à 10 problèmes corrigeables, sans jargon, classés par impact
4. Correctifs proposés    -> liste figée + avant/après visuel
5. 3 contenus rédigés     -> relecture, corrections (2 allers-retours), validation ferme
6. Connexions             -> son site + sa fiche Google Maps (ou création guidée de la fiche)
7. Récapitulatif + paiement unique
8. Déploiement            -> site et fiche Google Maps, journalisé
9. Compte rendu           -> avant / après + proposition de suivi mensuel
```

Une étape visible à la fois, un seul bouton, reprise possible là où le client s'est arrêté.

## Contenu de la page publique (à rédiger en premier, avant tout code)

- H1 orienté dirigeant (« Faites corriger votre visibilité en ligne, une fois, à prix fixe »), chapô, bloc de réponse directe cité par les IA.
- Ce que contient la passe, en langage client : ce qui sera corrigé sur le site, les 3 pages qui seront publiées, ce qui changera sur la fiche Google Maps.
- Le prix affiché, le délai annoncé, la garantie (remboursement avant déploiement).
- La preuve : avant / après réels, pas de captures de démo.
- Données structurées produit / offre, un seul H1, page rendue côté serveur, mise en cache, ajoutée au sitemap. Design noir et blanc, sans emoji, boutons à bordure.

## Ce qui doit encore être précisé avant le code

- **Le périmètre exact des correctifs site** inclus (titres, descriptions, balisage, vitesse ? — le verrou à définir pour ne pas promettre l'illimité).
- **Les sujets des 3 contenus** : choisis par le moteur à partir du diagnostic et présentés pour accord, ou fixés dès le départ ?
- **Le délai annoncé** entre paiement et déploiement (proposition : 72 h).
- **La garantie** : remboursement intégral tant que rien n'est déployé (proposition), et quelle politique après déploiement.
- **Remise éventuelle** vers l'abonnement de suivi dans le compte rendu final.

## Étapes d'implantation

1. **Commande en base** — `passe_orders` (étape, site, fiche visée, problèmes retenus, `paid_at`, `deployed_at`, compte rendu), `passe_order_contents` (versions de relecture), `passe_order_events` (journal), `passe_passes` (pass à usage unique, calqué sur le pass Marina). Isolation par utilisateur, droits explicites.
2. **Diagnostic réutilisé** — audit du site et score de fiche Google Maps existants ; filtre vers les 6-10 problèmes corrigeables. Aucune dépense d'IA avant l'étape 5.
3. **Les 3 contenus** — chaîne éditoriale existante en brouillon, génération unique + cache, corrections sans régénération complète, validation ferme du client.
4. **Connexions** — site (connecteurs CMS existants), fiche Google Maps (autorisation déjà gérée), création guidée de fiche si absente.
5. **Écriture Google Maps (à construire)** — mise à jour description, catégories, horaires, site web, création d'une publication ; aperçu avant / après validé par le client ; journal de chaque champ modifié.
6. **Paiement et verrou** — pass unique confirmé uniquement par webhook signé ; le déploiement lit le statut côté serveur et refuse si non payé.
7. **Déploiement et compte rendu** — publication site (instantané avant / après, réversible), application des modifications Google Maps (journal), compte rendu lisible + offre de suivi.
8. **Page publique** — contenu défini ci-dessus, performance mobile, référencement.
9. **Suivi interne** — onglet d'administration : commandes, étape bloquante, échecs de déploiement, relance.

## Détails techniques

- Paiement : réutilisation de la chaîne de pass unique Marina (`payments-webhook`, type de pass `passe_visibilite`), idempotence par référence de transaction.
- Tables : migration avec `GRANT` sur `authenticated` et `service_role`, RLS scopée `auth.uid()`, validations temporelles par déclencheur.
- Verrou de déploiement : lecture du statut de paiement avec le client de service uniquement ; aucune confiance au navigateur.
- Google Maps : nouvelles actions dans `gmb-actions` (`update-location-info`, `create-post`), portée `business.manage` déjà gérée par `gbp-auth`.
- Site : réutilisation de `cms-push-draft` / `cms-patch-content`, instantané dans `content_deploy_snapshots`.
- Page publique : route dédiée, ajout au cache HTML de `src/server.ts` et au sitemap.
