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
entre verticales.

**Support de paiement de la commission** : cash quand il y a un flux d'argent, crédits sinon.
- **Commande cash (carte)** : commission **retenue sur le flux**, le vendeur est crédité du net.
  Aucun solde de crédits requis — un vendeur n'est jamais bloqué faute de crédits. Le vendeur peut
  **optionnellement** choisir de payer en crédits et recevoir le brut.
- **Troc** (`link_chain`, `link_for_link`, cross-média) et soulte en crédits : commission
  **obligatoirement en crédits**, faute de flux à retenir.
- **Origine des crédits indifférente** : crédits achetés, offerts (bienvenue, parrainage, plan
  Jeune entreprise) ou versés en dédommagement paient tous la commission. Pas de solde à deux
  poches — décision explicite de l'utilisateur : l'exposition d'une dotation offerte est
  négligeable face au coût d'implémentation et de support.
- **Payeur** : le vendeur de chaque jambe. Sur un troc, les deux parties vendent une jambe, donc
  **chacune paie sa commission** sur la valeur de sa propre jambe.
- **Contrôle avant figeage** : sur un troc, soldes de crédits de toutes les parties vérifiés avant
  le figeage. Solde insuffisant → commande non figée. Jamais de figeage à crédit ni de solde négatif.
- **Taux figé** : quand la commission est réglée en crédits, `credit_eur_rate_at_freeze` est écrit
  sur la commande au figeage et sur la facture, jamais recalculé.
- **TVA 20 % en euros, toujours**, sur la contre-valeur figée : le règlement en crédits ne change
  ni la base d'imposition ni le montant dû à l'État.


## Hiérarchie des échanges sans cash
Ordre de préférence imposé au moteur d'appariement :
1. **`link_chain` (A→B→C→A)** — mode privilégié : boucle de 3 ou 4 participants, déclarée sous un
   `exchange_id` unique, 7 jours minimum entre deux jambes, **aucune décote**.
2. Troc cross-média (`link_for_linkedin`, `link_for_insta`) — pas de réciprocité de liens.
3. `link_for_link` — **dernier recours**, proposé uniquement si aucune boucle n'est constructible.

## link_for_link (réciprocité directe)
Autorisé, mais **en dernier recours, flaggé et bridé**, quatre garde-fous cumulés appliqués
serveur :
1. flag de risque affiché aux deux parties avant acceptation ;
2. délai minimum de 21 jours entre les deux publications, ordre tiré au sort ;
3. quota : 1 réciprocité par trimestre et par site, jamais deux fois avec le même partenaire
   sur 12 mois glissants ;
4. détection de cycle dans le graphe des liens échangés jusqu'à 4 sauts : seules les boucles
   **non déclarées** bloquent en 409.
**Exemption explicite** : la 2ᵉ jambe d'un troc déjà accepté (même `exchange_id`), et les arêtes
d'une boucle `link_chain` déclarée, ne sont jamais bloquées par la règle « lien déjà existant
entre les deux domaines » ni par la détection de cycle — sinon le mode serait inapplicable.
Décote d'équité réciproque : facteur **0,70** appliqué à la valeur de chaque jambe de
`link_for_link` avant calcul de l'écart et de la soulte. `link_chain` n'est jamais décoté.

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
Paliers v1 : P1 40 € · P2 90 € · P3 150 € · P4 250 € · **P5 350 €** (P5 = plafond atteignable par le pricing lui-même, réservé aux actifs `verified`, 90 j de signaux GSC et `sell_risk` faible ; aucune soulte cash au-dessus de P5).
Une soulte ne peut porter le total au-delà du plafond (`price_cents + soulte_cents ≤ 35000`).
1 crédit = 1 € pour le calcul d'équité. La soulte est une **valeur écrite** par la server function au
figeage de la commande (décote 0,70 + arrondi + plafond), jamais une colonne générée.

## Fenêtres acheteur
Toutes les bornes acheteur sont des **fenêtres glissantes**, jamais des mois calendaires :
≤ 4 liens entrants / 30 jours glissants et ≤ 2 / 7 jours glissants (`links_bought_30d`,
`links_bought_7d`).

## Engagement
`marketplace_orders.commitment_months` (défaut 12 pour un lien, 1 pour un contenu social) est la
seule base du prorata de remboursement en cas de retrait anticipé ; `commitment_ends_at` en dérive.

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

## Séquestre, acquisition progressive et clawback
Le net vendeur est mis en séquestre (`held`) au figeage, débloqué par tranches
(`net / commitment_months`), 1ʳᵉ tranche à J+30 après preuve de publication, tranche suivante
seulement si le dernier contrôle de maintien est `maintained` ; un verdict `broken` gèle le
calendrier. Remboursement au prorata prélevé dans cet ordre : `held` de la commande → `available`
→ `held` des autres commandes → dette de wallet. **Le solde du wallet n'est jamais négatif** : le
reliquat devient une dette (`marketplace_wallet_debts`) qui gèle vente et achat et absorbe 100 %
des crédits entrants. Récupération plafonnée au net perçu sur la commande, prescrite après
`commitment_ends_at + 30 j`. Tables : `marketplace_wallet_entries`, `marketplace_wallet_debts`.

## Fiscalité du troc (TVA 20 %)
Un troc lien/story est un double échange de services imposable : chaque jambe est facturée à sa
propre valeur (`marketplace_exchanges.value_cents`), **TVA 20 %** pour un assujetti FR, soulte au
même régime, commission 15 % facturée avec TVA 20 %. Autoliquidation UE si numéro VIES valide,
mention art. 293 B pour la franchise en base, **vente interdite aux non-assujettis (particuliers)**.
Crawlers facture au nom et pour le compte du vendeur (mandat de self-billing accepté à
l'onboarding) ; exigibilité = 1ʳᵉ preuve de publication ; avoir en cas de prorata ; DAC7 déclare
aussi les jambes en troc et les crédits. Tables : `marketplace_tax_profiles`,
`marketplace_invoices` (montants et TVA figés à l'émission).
