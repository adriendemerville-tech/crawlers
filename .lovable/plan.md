# Plan d'amélioration — Home pro mobile

Objectif : passer la home `/` (audience pro SEO) d'une page de 16 657 px / 2 226 mots / 21 sections à un parcours de conversion mobile court : **promesse → preuve → démonstration → inscription**, cible ~1 500 mots et ~6 sections.

## Étape 1 — Réduire la structure (impact majeur)

Réorganiser `src/pages/Index.tsx` en 6 sections :

1. **Hero** (existant `HomeHero`) : H1 + formulaire d'inscription — inchangé.
2. **Audit URL** (`AIVisibilitySection`) : champ URL + CTA « Audit Expert » — déjà épuré sur mobile.
3. **Preuve** : remonter des preuves vérifiables en position 3 (exemple de rapport, métriques produit réelles) — supprimer les 2 témoignages non vérifiables.
4. **Capacités clés** : fusionner « Score GEO », « Bots IA », « Visibilité LLM » en une seule section à 3 onglets.
5. **Agents IA + Marina** : fusionner en une seule section.
6. **Offre agence + FAQ + CTA final**.

Sections retirées de la home (contenu conservé sur leurs pages dédiées, avec lien) : Momentum, Pain Points, comparatifs longs, sections secondaires répétitives.

## Étape 2 — Corriger les débordements internes

- Cible identifiée : conteneur à largeur minimale `28 rem` (~448 px) qui dépasse à 360/390 px → passer en `min-w-0` + défilement interne ou réduction mobile.
- Supprimer/masquer les 3 halos décoratifs qui dépassent le cadre sur mobile.

## Étape 3 — Accessibilité tactile et lisibilité

- Cibles tactiles < 44 px (onglets à `text-[9px]`, petits liens) : porter à 44 px minimum et corps de texte lisible.
- Vérifier ordre de tabulation et contrastes sur les sections conservées.

## Étape 4 — Charte graphique

- CTA encore en dégradé/couleurs hors charte → variante `hero` (fond transparent, bordure, texte contrasté, largeur ajustée au libellé).
- Aligner l'ambiance visuelle sur `/audit-geo-seo` (plus claire et rassurante).

## Étape 5 — Corrections techniques mesurées

- Ressources en 404 (polices locales) : corriger les chemins ou supprimer les préchargements morts.
- Requête externe en 400 (Turnstile) : corriger la clé/config ou retarder le chargement à l'interaction.
- Attribution incorrecte de certains modèles LLM dans `llmVisibilityLite.functions.ts` : corriger le mapping.

## Étape 6 — Aiguillage non bloquant

- `AudienceRouter` : passer d'overlay bloquant à bandeau discret non modal, mémorisé, sans empêcher la lecture de la home.

## Vérification

- Playwright 360/390/430 px : aucune largeur excédentaire, hauteur page et nombre de mots mesurés avant/après.
- Build OK, zéro erreur console bloquante.
- Cible : ≤ ~8 000 px de hauteur mobile, ~1 500 mots, 6 sections, 1 action dominante par section.

## Hors scope

- Desktop détaillé (contrôle de non-régression uniquement).
- Refonte de `/audit-geo-seo`.
- Contenu des pages dédiées recevant les sections déplacées.
