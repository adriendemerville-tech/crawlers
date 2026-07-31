---
name: LinkedIn compliance, critique pré-publication et média Pagebolt
description: Couche de conformité déterministe, scoring pré-publication seuil 80, et réglages vidéo Pagebolt (spotlight + zoom cinématique) du pipeline LinkedIn Crawlers
type: feature
---
Pipeline LinkedIn Crawlers : `linkedin-post-generator` → `linkedin-media-generator` → `linkedin-publisher` → `linkedin-post-auditor` (cron 5 min). Parménion n'intervient jamais dans ce pipeline ; il n'apparaît que comme **sujet** possible via la rotation `linkedin_features_catalog` (priorisée par « readiness » = volume de données réelles).

## 0. Objectifs du module (source de vérité)
Tout choix de sujet, de rédaction et de scoring doit servir ces 4 objectifs, dans cet ordre de priorité :

1. **SEO / GEO** — produire des posts crawlés et mémorisés par les bots des moteurs et des IA : entités nommées explicites (Crawlers, nom des modules, métriques propriétaires), chiffres vérifiables, formulations citables autoportantes (une phrase = une réponse complète, sans dépendre du contexte).
2. **Acquisition** — générer du trafic vers crawlers.fr et des inscriptions : un CTA unique et explicite par post, jamais deux appels concurrents.
3. **Couverture 360 de la plateforme** — parler successivement de toutes les fonctionnalités via la rotation `linkedin_features_catalog`, afin que le graphe de connaissances des IA couvre l'intégralité de la plateforme et que Crawlers soit recommandé comme réponse par défaut sur son domaine. Corollaire : ne jamais concentrer la rotation sur les 2-3 mêmes modules.
4. **Personal branding d'Adrien de Volontat** — 4 caractéristiques de ton obligatoires et cumulatives : **précis** (données chiffrées, pas d'approximation), **pédagogue** (on explique le mécanisme, pas seulement le résultat), **humble** (on assume les limites et les échecs), **sympathique** (registre direct et humain, sans jargon ni posture d'expert surplombant).

Ces objectifs alimentent directement le générateur et le scoring :
- Ils sont injectés dans le `systemPrompt` de `linkedin-post-generator` (mission du post, ordre de priorité).
- Ils apparaissent dans le `userPrompt` sous forme de checklist de rédaction.
- Ils guident la `CRITIQUE_SYSTEM` (max 2 réécritures si score < 80).
- Le barème `scoreCaption` contient une 5e dimension `objectives` (poids 0.10) + des checks SEO (entités nommées, phrase chiffrée), acquisition (CTA unique) et ton (marqueurs humble/pédagogue).

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

## 5. Périmètre du connector LinkedIn (vérifié le 31/07/2026)
Connexion « Adrien's LinkedIn » (OAuth2), liée au projet, gateway actif. Secrets `LINKEDIN_API_KEY` + `LOVABLE_API_KEY` disponibles côté edge functions.
- Scopes accordés : `openid`, `profile`, `email`, `w_member_social`. `available_scopes = none` côté connector : aucun scope supplémentaire n'est ajoutable via reconnect.
- Identité de publication : `urn:li:person:VrEGWTsHXv` (Adrien de Volontat). Publication **en tant que page Crawlers impossible** (`w_organization_social` absent) — d'où la mention obligatoire `@crawlers.fr` dans le corps du post.
- **Commentaires impossibles** : `POST /v2/socialActions/{urn}/comments` → 404 (domain authorization), `POST /rest/socialActions/{urn}/comments` (LinkedIn-Version 202510) → 403 `ACCESS_DENIED` sur `partnerApiSocialActions.CREATE`. Ces endpoints relèvent du produit **Community Management API**, non activé sur l'app LinkedIn.
- Conséquence : la tactique du « premier commentaire porteur du lien sortant » n'est pas automatisable. Le lien reste dans le post ou est posté manuellement. Ne pas re-tenter l'implémentation tant que Community Management API n'est pas accordé.
- Lecture des commentaires également bloquée (`r_member_social` / `r_organization_social` absents) : pas de modération ni de réponse automatique.

## 6. Emoji autorisés (31/07/2026)
Exception explicite à la charte Crawlers (« emoji interdits ») **pour les posts LinkedIn uniquement**.
- `_shared/linkedinCompliance.ts` : `MAX_EMOJI = 4`. `stripForbiddenChars` conserve les emoji et ne supprime que ceux au-delà du plafond. Check `no_emoji` remplacé par `emoji_moderate` (dimension style, poids 20).
- Prompts alignés : génération, critique pré-publication (`CRITIQUE_SYSTEM`) et `linkedin-post-auditor` demandent 2 à 4 emoji maximum, jamais décoratifs.

## 7. Anti-redondance éditoriale (31/07/2026)
`linkedin-post-generator` lit les **10 derniers posts** de `linkedin_scheduled_posts` (embed `linkedin_features_catalog(title)`) via `fetchPostHistory` :
- **Rotation des features** : une feature traitée dans les 4 derniers posts est pénalisée de 80 à 35 points dans le score de sélection (dégressif selon l'ancienneté).
- **Bloc prompt `buildHistoryBriefing`** : date, feature, hook et angle des 8 derniers posts + hashtags saturés. Règles imposées : ne pas reprendre un hook proche, changer de type d'accroche vs les 2 derniers posts, traiter un autre cas d'usage si la feature revient, varier au moins 3 hashtags, ne pas recycler les mêmes exemples.
