---
name: Portée et limites — génération backend Marina
description: Section « Portée et limites » toujours générée côté backend Marina depuis le nom de domaine, mutualisée en fin de rapport multipages
type: feature
---
Contrat non négociable : tout rapport Marina contient une section « Portée et limites ».

- Module backend : `supabase/functions/_shared/scopeAndLimits.ts` → `renderScopeLimitsHTML({ domain, url, lang, pagesAnalyzed, pagesKnown, singlePage, analyzedAt, authority, blockers })`.
- Générée dès le départ à partir du nom de domaine : `compileMarinaReport` appelle un fallback `renderScopeLimitsHTML({ domain, url, lang })` si l'appelant ne fournit pas de version enrichie. Elle ne peut donc jamais manquer.
- Version enrichie au point d'appel du worker : périmètre crawlé (`crawlSnapshot`), autorité (`strategicData.domain_authority`, ignorée si `data_source === 'unavailable'`), freins de crawlabilité via `buildCrawlabilityBlockers()` (partagé avec la divulgation méthodologique).
- Balises : `data-pdf-section="disclaimer"` (évite le double ajout par `sectionBasedPdfExport`) + `data-marina-scope="site" data-marina-block="scope_limits"` (mutualisation multipages).
- `src/lib/marina/mergeReports.ts` extrait `scope_limits` et le place une seule fois, en toute dernière section du PDF fusionné, après la divulgation méthodologique.
- 6 blocs : mesuré / estimé / périmètre / maturité du domaine / crawlabilité / maturité du marché et bascule IA. FR-EN-ES, aucun emoji.
