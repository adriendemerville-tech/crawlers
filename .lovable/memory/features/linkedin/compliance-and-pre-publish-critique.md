---
name: LinkedIn compliance, critique pré-publication et média Pagebolt
description: Couche de conformité déterministe, scoring pré-publication seuil 80, et réglages vidéo Pagebolt (spotlight + zoom cinématique) du pipeline LinkedIn Crawlers
type: feature
---
Pipeline LinkedIn Crawlers : `linkedin-post-generator` → `linkedin-media-generator` → `linkedin-publisher` → `linkedin-post-auditor` (cron 5 min). Parménion n'intervient jamais dans ce pipeline ; il n'apparaît que comme **sujet** possible via la rotation `linkedin_features_catalog` (priorisée par « readiness » = volume de données réelles).

## 1. Couche de conformité déterministe — `supabase/functions/_shared/linkedinCompliance.ts`
`enforceCaptionCompliance(text)` : 100 % code, aucune dépendance LLM.
- Supprime emojis, tirets cadratins et caractères réservés.
- Borne la longueur à 1000–1500 signes hors hashtags, coupe sur frontière de phrase.
- Injecte la mention obligatoire `@crawlers.fr` si absente.

`scoreCaption(text)` : score pondéré 0–100 — hook 0.35, produit 0.30, précision 0.20, style 0.15. Retourne le détail des checks échoués.

## 2. Critique pré-publication
Dans `linkedin-post-generator` : si `scoreCaption < 80`, jusqu'à **2 réécritures ciblées** (`mistralai/mistral-large-2512`) guidées par les checks échoués. Résultat persisté dans `linkedin_scheduled_posts.pre_publish_score` (int) et `pre_publish_report` (jsonb). `linkedin-post-auditor` réutilise le même barème après publication (cible 90, cf. mémoire auditeur).

## 3. Média Pagebolt — `_shared/pageboltScenario.ts` + `linkedin-media-generator`
- `/v1/video` : `pace: 'slow'`, curseur `spotlight` violet Crawlers `#7C3AED`, `persist: true`, `size: 26`, `smoothing: true` (lisibilité feed mobile).
- **Zoom cinématique par étape** : appliqué aux actions `click` uniquement. Niveaux alternés `1.4 / 1.6 / 1.5`, dernier clic à `1.7` (punchline). Un scénario peut imposer son propre niveau, borné 1.1–2.0 par `sanitizeScenario`.
- `/v1/sequence` (carrousel) : le zoom est retiré (non supporté par cette API).
- Conséquence rédactionnelle : plus le scénario contient de **clics réels** (vs scroll), plus la vidéo est dynamique — `linkedin-scenario-builder` doit privilégier les clics.
- Les screencasts filment l'outil en usage réel authentifié, jamais la landing page.

## 4. Statuts
Aucun statut `draft` : les posts générés sont `approved` par défaut (automatisation complète, correction a posteriori si besoin).
