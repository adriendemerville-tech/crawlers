---
name: Place d'échange — règles cœur v1
description: Commission unique 15 %, link_for_link bridé, propriété vérifiée avant mise en vente, bornes de prix 40-350 € par paliers de 10 €
type: feature
---

Décisions arbitrées par l'utilisateur le 2026-08-22, valables dans toute la v1 de la Place
d'échange (liens, LinkedIn, Instagram). Toute autre valeur dans le code, l'UI, les CGVU ou la
documentation est une incohérence à corriger.

## Commission
**15 %**, taux unique. Aucune distinction entre `deal_type` (`cash`, `credits`, `barter`) ni
entre verticales. Prélevée en euros sur une vente cash, en crédits sur un troc (15 % de la
valeur estimée de chaque jambe).

## link_for_link (réciprocité directe)
Autorisé, mais **flaggé et bridé**, quatre garde-fous cumulés appliqués serveur :
1. flag de risque affiché aux deux parties avant acceptation ;
2. délai minimum de 21 jours entre les deux publications, ordre tiré au sort ;
3. quota : 1 réciprocité par trimestre et par site, jamais deux fois avec le même partenaire
   sur 12 mois glissants ;
4. détection de cycle dans le graphe des liens échangés jusqu'à 4 sauts (A→B→A, A→B→C→A) :
   toute boucle bloque la proposition en 409, sans forçage possible.
Décote d'équité réciproque : facteur **0,70** appliqué à la valeur de chaque jambe avant calcul
de l'écart et de la soulte.

## Vérification de propriété
**Obligatoire avant toute mise en vente** — prérequis technique bloquant, pas une déclaration.
Un actif non vérifié reste `unverified` : hors inventaire, hors appariement, hors troc.
- Domaine/page : propriété GSC confirmée, ou DNS `TXT crawlers-verify=<token>`, ou fichier
  `/.well-known/crawlers-verify.txt`. Revérification tous les 30 jours.
- LinkedIn / Instagram : OAuth du compte qui publiera.
- Un domaine ne peut être vérifié que par un seul compte ; conflit → premier vérifié gagne.
- Perte de preuve → actif retiré de l'inventaire, commandes en cours honorées ou remboursées.
La déclaration de responsabilité horodatée reste en plus de la preuve technique (elle établit le
contrôle du site, pas le mandat juridique).

## Bornes de prix
Plancher **40 €** et plafond **350 €** durs, sans dérogation ni validation admin. Tous les prix
sont des multiples de **10 €**, y compris les soultes et les valorisations d'actifs sociaux
(LinkedIn, Instagram), qui utilisent la même échelle que les liens.
Paliers v1 : P1 40 € · P2 90 € · P3 150 € · P4 250 €.
Une soulte ne peut porter le total au-delà du plafond. 1 crédit = 1 € pour le calcul d'équité.

## Exposition des signaux GSC (confidentialité)
Aucune valeur GSC exacte n'est jamais exposée à un acheteur ou en public : uniquement des
**fourchettes** et des scores normalisés 0-100, produits serveur par la vue
`marketplace_asset_public_signals`. Les colonnes brutes ont un `SELECT` réservé au propriétaire
(`auth.uid()`) et à `service_role`.
- Fourchettes : clics 90j `0 | 1-10 | 11-50 | 51-200 | 201-1000 | 1001-5000 | 5000+` ;
  impressions `0-100 | 101-1000 | 1001-10000 | 10001-50000 | 50001-250000 | 250000+` ;
  position `1-3 | 4-10 | 11-20 | 21+`.
- Jamais exposés : requêtes/mots-clés, courbes temporelles, trafic du domaine entier, part de
  trafic par pays/device. Tendance réduite à `hausse` / `stable` / `baisse`, thématiques en
  clusters (1 à 3).
- Si clics 90j ≤ 10 → mention « trafic faible / non significatif », pas de fourchette basse.
- Pas de dé-anonymisation par différence (fenêtre 90j figée, rafraîchie au plus 1×/7j, pas
  d'historique de fourchettes) ; max 5 pages d'un même vendeur avec fourchettes par réponse.
- Une commande ne donne aucun accès supplémentaire : le suivi post-publication porte sur la
  présence du lien, pas sur son trafic.
- L'opt-in de mise en vente énumère explicitement ce qui sera visible et ce qui ne le sera jamais.
