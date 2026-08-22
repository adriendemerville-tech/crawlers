# Plan gratuit « Jeune entreprise » — offre d'amorçage Crawlers

Décision de **pricing plateforme**, indépendante de la Place d'échange. Ce document est la source
de vérité de l'offre : éligibilité, quotas, dégradations techniques, économie et séquencement.

---

## 1. Objectif

Amorcer la base d'utilisateurs actifs en donnant un accès complet à des entreprises trop jeunes
pour payer, à un coût marginal maîtrisé, et convertir une partie d'entre elles en clients payants
avant la fin des 12 mois. L'offre est un levier d'acquisition et de preuve sociale, pas une
générosité ouverte : elle est plafonnée en nombre de comptes, en durée et en consommation.

## 2. Éligibilité

- Entreprise de **moins de 12 mois** à la date de candidature, **Kbis (ou équivalent UE) à l'appui**.
- **Sur candidature**, validation manuelle admin (un compte par entreprise, un par dirigeant).
- **30 comptes maximum** en simultané ; au-delà, liste d'attente.
- Non cumulable avec un autre avantage commercial (code promo, remise agence, essai en cours).
- Refus si le domaine déclaré appartient déjà à un compte payant ou a déjà bénéficié de l'offre.

## 3. Contenu de l'offre

- Accès **complet à toute la plateforme** pendant **12 mois** (mêmes modules qu'un plan payant).
- **Plafond dur de 60 crédits/mois**, non cumulables, reset au 1er du mois, **blocage strict** au
  dépassement (pas de découvert, pas de dérogation automatique).
- Actions chères bornées explicitement : Marina prospection (30 crédits) limitée à **1/mois**.
- **Crons dégradés** : surveillance hebdomadaire au lieu de quotidienne (crawl, GSC, drop detector).
- **Routage LLM économique** (Gemini Flash / Groq) sur toutes les tâches non critiques de ces
  comptes, conformément au routeur LLM admin.
- **Support communautaire uniquement**, mentionné explicitement dans les conditions.
- Le dépassement se règle par **packs de crédits** au tarif public : c'est le principal canal de
  monétisation de l'offre avant la conversion.

## 4. Implémentation technique

- Flags profil : `startup_offer` (bool) et `startup_offer_expires_at` (timestamptz), écrits
  **exclusivement côté serveur** par une action admin ; jamais depuis le client.
- Quota dédié dans le moteur de crédits : plafond mensuel évalué avant chaque action payante,
  message d'erreur explicite au blocage (pas d'échec silencieux).
- Priorité de file d'attente des jobs alignée sur la grille existante : ces comptes se placent au
  niveau `registered`, jamais au niveau des plans agence.
- Sélection du modèle LLM forcée sur le palier économique quand `startup_offer` est actif et que la
  tâche n'est pas critique.
- Expiration : à `startup_offer_expires_at`, bascule automatique en plan gratuit standard, données
  conservées, modules payants verrouillés — aucune suppression de compte.
- Candidatures tracées (dossier, Kbis, décision, admin décideur, horodatage) pour l'audit.

## 5. Économie

- Coût estimé : **~1,75 €/compte/mois**, soit **~780 €/an pour 30 comptes**.
- Couverture : packs de crédits achetés en dépassement, conversion à l'issue des 12 mois, et
  revenus de plateforme ; l'offre reste nette positive tant que le plafond de 30 comptes tient.
- Risque assumé : les comptes gratuits génèrent plus de sollicitations de support que les payants —
  d'où le support communautaire strict.

## 6. Conversion

- Séquence automatique de conversion déclenchée à **M10** : bilan de valeur produite sur 10 mois
  (audits, pages publiées, positions gagnées) puis proposition de plan payant.
- Relance à M11 et M12, puis bascule automatique en plan gratuit standard.
- Indicateur à suivre : taux de conversion des comptes `startup_offer` en payants, consommation
  moyenne de crédits, et part des comptes inactifs (à ne pas renouveler).

## 7. Textes à modifier

### `/tarifs`
- Bloc « Jeune entreprise — 12 mois offerts » (60 crédits/mois, sur candidature, 30 places),
  positionné avant Pro Agency.
- Conditions lisibles : ancienneté < 12 mois, Kbis, plafond de crédits, support communautaire,
  crons hebdomadaires, expiration à 12 mois.

### CGVU
- Conditions d'éligibilité, plafond de crédits et blocage au dépassement, support communautaire,
  durée de 12 mois non reconductible, conditions de retrait de l'offre en cas d'abus (comptes
  multiples, fausse déclaration d'ancienneté).

## 8. Séquencement

| Lot | Contenu |
|---|---|
| J1 | Flags profil + quota dédié dans le moteur de crédits + blocage strict au dépassement |
| J2 | Crons dégradés + routage LLM économique + priorité de file `registered` |
| J3 | Formulaire de candidature, back-office de validation admin, traçabilité des dossiers |
| J4 | Textes `/tarifs` et CGVU |
| J5 | Séquence de conversion M10-M12 + expiration automatique + tableau de suivi admin |

## 9. Risques

- **Abus d'ancienneté** : sociétés créées pour l'occasion → contrôle Kbis manuel, un compte par
  dirigeant, refus si le domaine a déjà bénéficié de l'offre.
- **Charge de support** : bornée par le support communautaire, à surveiller mensuellement.
- **Cannibalisation** : une petite agence pourrait préférer l'offre gratuite à Pro Agency → limite
  d'ancienneté stricte et plafond de crédits bas pour éviter la substitution.
- **Coût LLM** : plafonné par le routage économique et le plafond de crédits ; à recouper avec le
  plafond de dépense quotidien des agents.
