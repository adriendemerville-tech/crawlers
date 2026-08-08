---
name: Bloc Marché & Autorité (Authority Score)
description: Module partagé domainAuthority.ts — backlinks DataForSEO, Authority Score recalibré /92, toxicité du profil de liens et visibilité organique
type: feature
---
`supabase/functions/_shared/domainAuthority.ts` : source unique pour les backlinks, l'autorité de domaine et la toxicité du profil de liens.

- Appels DataForSEO : `backlinks/summary/live` + `backlinks/referring_domains/live` (top 10), cache 24 h via `auditCache`, clé versionnée par `AUTHORITY_CALIBRATION_VERSION`.
- `normalizeDomainRank` (calibration v2, 2026-08-08) : l'échelle rank backlinks est 0–1000 et logarithmique → courbe `95 * (r/1000)^1.8` (1000→95, 600→38, 300→11). L'ancienne division par 10 saturait à 100/100 des domaines réellement à ~38 (constaté sur avenir-renovations.fr vs Semrush).
- `computeAuthorityScore(rank, refDomains, { toxicityScore, avgReferrerRank })` = 60 % rank normalisé + 40 % diversité `log10(ref)*11` pondérée par la qualité moyenne des référents, moins une pénalité de toxicité (max −45 %), **plafonné à 92** (jamais 100).
- `computeBacklinkToxicity` : 100 % déterministe, aucun appel supplémentaire (ancre dominante, ancres non naturelles URL/générique/emoji, rank moyen des référents, liens par domaine, liens cassés, dofollow ~100 %) → `toxicity_score` /100 et verdict `sain` / `a_surveiller` / `pollue` + recommandation de désaveu.
- `confidence` (`high|medium|low`) + `confidence_reason` selon la complétude de la réponse ; log d'alerte si le score dépasse 90 (garde-fou anti-régression).
- `organic_visibility` : trafic estimé, mots-clés positionnés, position moyenne, top3/top10 — renseigné par les appelants depuis `rankingOverview` déjà collecté (aucun appel payant supplémentaire).
- `buildAuthorityPromptSection` injecte autorité + toxicité + visibilité, et interdit explicitement au LLM de présenter l'Authority Score comme un chiffre Semrush/Moz/Majestic.
- Tests figés : `supabase/functions/_shared/domainAuthority_test.ts` (5 tests Deno).

Câblage :
- `audit-strategique-ia` : Wave 2 (deadline 30 s), `organic_visibility` ajoutée après collecte, exposé en `data.domain_authority`, alimente `computeFactualCitationScores`.
- `strategic-synthesis` : idem via `body.authorityData` ou refetch.
- UI : `src/components/ExpertAudit/DomainAuthorityCard.tsx` (score + fiabilité + bloc toxicité + visibilité organique).
- PDF : section « Marché & Autorité (backlinks) » dans `expertReportExport.ts` (méthode, fiabilité, toxicité, visibilité).
- `scopeAndLimits.ts` : mention obligatoire « estimation propriétaire Crawlers, pas un score Semrush/Moz/Majestic ».
- Workbench : `finding_category` `domain_authority` (AS < 35), `backlink_health` (>10 % de liens cassés) et `backlink_toxicity` (verdict ≠ sain) — mappés par `cocoon-strategist` en `add_internal_link` (aucune action offsite automatique).
