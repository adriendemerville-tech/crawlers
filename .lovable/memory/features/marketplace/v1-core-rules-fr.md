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
