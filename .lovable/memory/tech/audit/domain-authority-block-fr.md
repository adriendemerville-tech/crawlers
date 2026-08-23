---
name: Bloc Marché & Autorité (Authority Score)
description: Module partagé domainAuthority.ts — backlinks DataForSEO, Authority Score recalibré /92, toxicité du profil de liens et visibilité organique
type: feature
---
`supabase/functions/_shared/domainAuthority.ts` : source unique pour les backlinks, l'autorité de domaine et la toxicité du profil de liens.

- Appels DataForSEO (4 en parallèle, cache 24 h via `auditCache`, clé versionnée par `AUTHORITY_CALIBRATION_VERSION` = 4) : `backlinks/summary/live` + `backlinks/referring_domains/live` (**limit 200**, `REFERRING_DOMAINS_SAMPLE_LIMIT`) + `backlinks/anchors/live` (**limit 100**, `ANCHORS_SAMPLE_LIMIT`) + `backlinks/domain_pages/live` (**limit 50**, `LINKED_PAGES_SAMPLE_LIMIT`).
- Lot 1 (2026-08-19) : les ancres sont **mesurées** via l'endpoint dédié (`extractAnchorsFromEndpoint`) et non plus déduites de `referring_links_anchors` ; repli explicite sur le résumé si l'endpoint échoue. Champs exposés : `referring_domains_sampled`, `anchors_sampled`, `anchors_source` (`anchors_endpoint` | `summary_sample` | `unavailable`).
- Lot 2 (2026-08-19) — **répartition du profil** (`BacklinkDistribution`, 0 token LLM, 1 seul appel payant ajouté) :
  - `extractDistribution()` lit les cartes déjà présentes dans `summary` (`referring_links_tld`, `referring_links_countries`, `referring_links_platform_types`) → parts triées, aucun crédit supplémentaire.
  - `extractLinkedPages()` lit `backlinks/domain_pages/live` → `top_linked_pages` (top 10) avec domaines référents par page.
  - `computeBacklinkDistribution()` produit des constats déterministes : mono-TLD (>=85 %), concentration géographique (>=90 %), dispersion (<40 %), dépendance à une page unique (>=80 % des référents), monoculture de plateformes (>=70 %), + recommandation priorisée (diluer l'entonnoir de liens > élargir la géographie > élargir les TLD).
  - `source` = `dataforseo` / `partial` / `unavailable`, `confidence` dégradée si la répartition manque ou est partielle. Aucune conclusion sans mesure.
  - Rendu : `buildAuthorityPromptSection` (TLD, pays, plateformes, pages cibles, concentration) et `DomainAuthorityCard` (grille TLD/Pays/Plateformes + pages cibles + signaux).
- `computeBacklinkToxicity` accepte `sampleReferringDomains` (échantillon 200) pour le rank moyen des référents et la détection de domaines hors-sujet ; `topReferringDomains` reste l'affichage (top 10). Sans échantillon, comportement historique conservé.
- `confidence` dégradée si l'échantillon de référents est réduit (<50 pour >50 domaines) ou si les ancres viennent du résumé ; `confidence_reason` porte les tailles d'échantillon et remonte jusqu'au prompt et à `DomainAuthorityCard`.
- `normalizeDomainRank` (calibration v2, 2026-08-08) : l'échelle rank backlinks est 0–1000 et logarithmique → courbe `95 * (r/1000)^1.8` (1000→95, 600→38, 300→11). L'ancienne division par 10 saturait à 100/100 des domaines réellement à ~38 (constaté sur avenir-renovations.fr vs Semrush).
- `computeAuthorityScore(rank, refDomains, { toxicityScore, avgReferrerRank })` = 60 % rank normalisé + 40 % diversité `log10(ref)*11` pondérée par la qualité moyenne des référents, moins une pénalité de toxicité (max −45 %), **plafonné à 92** (jamais 100).
- `computeBacklinkToxicity` : 100 % déterministe, aucun appel supplémentaire (ancre dominante, ancres non naturelles URL/générique/emoji, rank moyen des référents, liens par domaine, liens cassés, dofollow ~100 %) → `toxicity_score` /100 et verdict `sain` / `a_surveiller` / `pollue` + recommandation de désaveu.
- `confidence` (`high|medium|low`) + `confidence_reason` selon la complétude de la réponse ; log d'alerte si le score dépasse 90 (garde-fou anti-régression).
- `organic_visibility` : trafic estimé, mots-clés positionnés, position moyenne, top3/top10 — renseigné par les appelants depuis `rankingOverview` déjà collecté (aucun appel payant supplémentaire).
- `buildAuthorityPromptSection` injecte autorité + toxicité + visibilité, et interdit explicitement au LLM de présenter l'Authority Score comme un chiffre Semrush/Moz/Majestic.
- Tests figés : `supabase/functions/_shared/domainAuthority_test.ts` (11 tests Deno).

Câblage :
- `audit-strategique-ia` : Wave 2 (deadline 30 s), `organic_visibility` ajoutée après collecte, exposé en `data.domain_authority`, alimente `computeFactualCitationScores`.
- `strategic-synthesis` : idem via `body.authorityData` ou refetch.
- UI : `src/components/ExpertAudit/DomainAuthorityCard.tsx` (score + fiabilité + bloc toxicité + visibilité organique).
- PDF : section « Marché & Autorité (backlinks) » dans `expertReportExport.ts` (méthode, fiabilité, toxicité, visibilité).
- `scopeAndLimits.ts` : mention obligatoire « estimation propriétaire Crawlers, pas un score Semrush/Moz/Majestic ».
- Workbench : `finding_category` `domain_authority` (AS < 35), `backlink_health` (>10 % de liens cassés) et `backlink_toxicity` (verdict ≠ sain) — mappés par `cocoon-strategist` en `add_internal_link` (aucune action offsite automatique).

## Lot 3 — Historique propriétaire (`_shared/authoritySnapshots.ts`)

- Table `domain_authority_snapshots` : une ligne par domaine et par mois (`month` `YYYY-MM`), RLS + GRANT appliqués.
- `persistAuthoritySnapshot(authorityData)` écrit le snapshot du mois courant, amorce la série via `backlinks/history/live` (rafraîchi au maximum tous les 28 jours) et renvoie un `AuthorityTrend`.
- Verdicts déterministes : `premiere_mesure`, `acquisition_en_hausse`, `profil_stable`, `perte_de_liens`, `historique_indisponible`. Aucune inférence LLM.
- `buildAuthorityTrendPromptSection` injecte la tendance mesurée dans le prompt ; si l'historique manque, la section le dit explicitement.
- Workbench : `perte_de_liens` crée un constat `backlink_health` / `authority_trend_{domaine}`.

## Lot 4 — Link gap exécutable (`_shared/linkGap.ts`)

- Un seul appel payant : `backlinks/domain_intersection/live` (site en cible 1, jusqu'à 3 concurrents), cache 7 jours.
- Concurrents résolus par `resolveCompetitorDomains` : carte d'identité d'abord, concurrents SERP détectés en repli ; les noms commerciaux sans domaine et les plateformes génériques (Google, Facebook, LinkedIn…) sont rejetés.
- `parseIntersection` exclut tout domaine qui lie déjà le site audité, trie par nombre de concurrents liés puis par rank.
- Workbench : `finding_category = 'link_gap'` — un constat de synthèse (`link_gap_{domaine}`) + jusqu'à 5 tâches unitaires nominatives (`link_gap_{domaine}_{cible}`).
- `cocoon-strategist` mappe `link_gap` en `fix_technical` / `operational_queue` avec `offsite_action: true` et `requires_human_validation: true` : l'acquisition de lien n'est jamais autonome.
- Si aucun concurrent exploitable n'est déclaré, le link gap est explicitement non mesuré (`source: 'no_competitors'`) — jamais estimé.
- Tests : `supabase/functions/_shared/linkGap.test.ts` (6 tests Deno).

## Correctif transverse

`audit-strategique-ia` insérait ses constats avec `source_type: 'audit'`, valeur absente de l'enum `diagnostic_source_type` : **tous** les upserts Workbench de cette fonction échouaient silencieusement. Corrigé en `audit_strategic` (chunkability, fan-out, autorité, liens cassés, toxicité, réécriture AEO).

## Section dédiée « Profil de backlinks » (rapports)

- `supabase/functions/_shared/backlinkSection.ts` → `buildBacklinkSectionHTML(authority, trendHtml)` : section autonome, 0 token LLM, qui remplace le dump JSON « Marché et autorité de domaine » dans Marina.
- Contenu : volumétrie (liens **externes** uniquement, liens/domaine, dofollow, cassés), reconstitution du calcul de l'Authority Score, **tableau du détail du score de toxicité** (signal / mesure / règle appliquée / points, total borné à 100, seuils 0-34 sain · 35-59 à surveiller · 60-100 pollué), répartition TLD/pays/plateformes, top référents, ancres, pages les plus liées, tendance, puis fiabilité de l'échantillon.
- `toxicityPenaltyRows()` rejoue exactement les formules de `computeBacklinkToxicity` (le nombre de référents hors-sujet est relu depuis `signals`) : chaque point affiché est vérifiable à la main.
- Mesure indisponible → bloc explicite « aucune conclusion » au lieu d'un score.
