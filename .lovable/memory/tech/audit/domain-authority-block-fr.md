---
name: Bloc Marché & Autorité (Authority Score)
description: Module partagé domainAuthority.ts — backlinks DataForSEO + Authority Score /100 injecté dans l'audit stratégique et la synthèse
type: feature
---
`supabase/functions/_shared/domainAuthority.ts` : source unique pour les backlinks et l'autorité de domaine.

- Appels DataForSEO : `backlinks/summary/live` + `backlinks/referring_domains/live` (top 5), cache 24 h via `auditCache`.
- `normalizeDomainRank` : le rank backlinks DataForSEO est sur 0–1000 → normalisé sur 0–100 (division par 10 si > 100).
- `computeAuthorityScore(domainRank, referringDomains)` = 60 % rank normalisé + 40 % diversité `log10(ref_domains) * 11`, borné 0–100.
- `buildAuthorityPromptSection` injecte le bloc texte dans les prompts LLM.

Câblage :
- `audit-strategique-ia` : collecte en Wave 2 (deadline 30 s), stocké dans `_cachedContext.authorityData`, passé à `buildUserPrompt` (11e paramètre), alimente `computeFactualCitationScores({ backlinkData })`, exposé en `data.domain_authority`.
- `strategic-synthesis` : réutilise `body.authorityData` ou refetch, injecte dans le prompt marché + `citationScorer`, exposé en `domain_authority`.

Diffusion (2026-08-08) :
- UI : `src/components/ExpertAudit/DomainAuthorityCard.tsx` dans `StrategicInsights`.
- PDF : section « Marché & Autorité (backlinks) » dans `expertReportExport.ts` (message explicite si `data_source !== 'dataforseo'`).
- Workbench : `audit-strategique-ia` écrit `finding_category='domain_authority'` (AS < 35) et `'backlink_health'` (>10 % de backlinks cassés), site-level, hors gate `isContentMode`.
- Parménion : ces catégories sont mappées par `cocoon-strategist` en tâches `add_internal_link` (aucune action offsite).
