# Recalibrage du bloc Marché & Autorité (contradictions Semrush)

Objectif : supprimer les chiffres faux ou trompeurs du bloc autorité, et ajouter les deux angles morts révélés par la confrontation Semrush (toxicité des liens, trafic/positions réels).

## Constat

| Métrique | Marina/Audit | Semrush | Diagnostic |
|---|---|---|---|
| Autorité domaine | 100/100 | 38/100 | Normalisation cassée : saturation |
| Domaines référents | 590 | 1 170 | Sous-échantillonnage DataForSEO |
| Backlinks | 19 133 | 30 450 | Cohérent en ordre de grandeur |
| Trafic organique | absent | ~53 600/mois | Angle mort |
| Toxicité des liens | absente | profil annuaire/MFA | Angle mort le plus actionnable |

## Lot 1 — Corriger l'Authority Score (`_shared/domainAuthority.ts`)

1. `normalizeDomainRank` : remplacer la division conditionnelle par une échelle logarithmique calibrée sur l'échelle backlinks DataForSEO (0–1000), qui est elle-même logarithmique. Un rank 1000 doit sortir ~95, pas 100 ; un rank 600 doit sortir ~40.
2. `computeAuthorityScore` : plafonner à 92 hors validation externe, et pondérer la diversité par la qualité moyenne des référents (pas seulement leur nombre).
3. Ajouter `confidence: 'high' | 'medium' | 'low'` selon la complétude de la réponse DataForSEO, et l'afficher partout (UI, PDF, prompt).
4. Tests déterministes sur des cas connus (rank 1000 / 600 / 200 / 0) pour figer la courbe.

## Lot 2 — Nouveau sous-bloc « Toxicité du profil de liens »

Dans le même module, à partir des données déjà payées (aucun appel supplémentaire) :
- ratio d'ancre dominante (une ancre répétée > 30 % = signal fort),
- part de référents à rank faible,
- part d'ancres non naturelles (URL nue, emoji, mot générique),
- verdict déterministe : sain / à surveiller / pollué, avec recommandation désaveu.

Un appel supplémentaire `backlinks/anchors/live` uniquement si le ratio d'ancre dominante ne peut pas être calculé depuis le summary.

## Lot 3 — Combler l'angle mort trafic/positions

Le bloc actuel ne dit rien du trafic organique ni des positions. Ajouter dans `domainAuthority.ts` un volet visibilité organique (trafic estimé, nombre de mots-clés, top requêtes) alimenté par l'endpoint déjà utilisé ailleurs dans le projet, avec le même cache 24 h.

## Lot 4 — Diffusion des corrections

- `audit-strategique-ia` et `strategic-synthesis` : passer les nouveaux champs.
- `_shared/strategicAudit/prompts.ts` et `buildAuthorityPromptSection` : injecter toxicité + visibilité, avec interdiction explicite d'inventer un chiffre absent.
- `DomainAuthorityCard.tsx` : afficher le niveau de confiance et le verdict de toxicité.
- `expertReportExport.ts` : même contenu dans le PDF.
- `scopeAndLimits.ts` : mentionner que l'autorité est une estimation propriétaire, non un score Semrush ou Moz.
- Workbench : nouveau `finding_category='backlink_toxicity'` consommé par `cocoon-strategist` (recommandation désaveu, pas d'action offsite automatique).

## Lot 5 — Garde-fou anti-régression

Un test de cohérence : tout score d'autorité ≥ 95 ou tout écart > 40 points entre rank normalisé et diversité déclenche un log d'alerte au lieu d'être publié en silence.

## Détails techniques

- Aucun appel DataForSEO supplémentaire dans les lots 1, 2 et 4 (réutilisation du cache 24 h existant).
- Un seul appel supplémentaire possible en lot 3, mutualisé avec le cache Marina.
- Recette : rejouer l'audit stratégique sur `avenir-renovations.fr` et vérifier que l'autorité tombe dans la fourchette 35–45.
