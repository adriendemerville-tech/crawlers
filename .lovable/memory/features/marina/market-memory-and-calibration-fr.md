---
name: Mémoire de marché & calibration des archétypes
description: market_observations (ML-ready) + archetype_mix_benchmarks calibrés par secteur × modèle commercial, taxonomie sectorielle déterministe, prescriptions archétypes poussées dans architect_workbench
type: feature
---

# Mémoire de marché et calibration sectorielle (Marina)

## Principe
Les cibles de mix de gabarits ne sont plus uniquement posées a priori : chaque audit Marina
dépose une observation de marché, et un cron hebdomadaire en dérive des fourchettes réelles.

## Tables
- `market_observations` — une ligne par (domaine, source, jour), historisée, jamais écrasée d'un
  jour sur l'autre (`UNIQUE (domain_hash, source, observed_on)`). Contient secteur brut +
  normalisé, modèle commercial, entity_type, cible, concurrents, `archetype_mix` (part + pages +
  action par gabarit), couverture crawl/sitemap, verdict, problème principal, scores SEO/GEO/autorité.
  RLS : lecture propriétaire uniquement (`user_id = auth.uid()`), écriture service_role.
  → base d'apprentissage supervisé ultérieure (features = mix + secteur, labels = scores).
- `archetype_mix_benchmarks` — p20/p50/p80 + `sample_size` par (secteur, modèle commercial, gabarit).
  Lisible par tout compte authentifié car strictement agrégé/anonymisé (aucun domaine).

## Fonctions SQL
- `refresh_archetype_mix_benchmarks()` — cron `refresh-archetype-mix-benchmarks`, dimanche 03h UTC.
  Fenêtre 180 jours, **une valeur moyenne par domaine** (un site souvent audité ne domine pas),
  publication uniquement si `sample_size >= 5` domaines distincts. Secteur `unknown` exclu.
- `get_archetype_mix_benchmarks(p_sector, p_model)` — priorité secteur+modèle, repli secteur seul.

## Modules partagés
- `_shared/sectorTaxonomy.ts` — `normalizeSector()` (24 secteurs contrôlés, regex, 0 token LLM) et
  `normalizeCommercialModel()` (local_service / ecommerce / saas / lead_gen / media / non_commercial).
  Indispensable : `tracked_sites.market_sector` est du texte libre LLM, non regroupable tel quel.
- `_shared/marketObservations.ts` — `buildMarketProfile()`, `fetchArchetypeBenchmarks()`,
  `writeMarketObservation()`. `domain_hash` = SHA-256 du domaine (clé d'agrégation cross-compte).
- `_shared/pageArchetypes.ts` — `analyzePageArchetypes(pages, options)` accepte `benchmarks` et
  `sectorLabel` (ancienne signature `(pages, sitemapUrls)` toujours supportée). Chaque entrée du mix
  porte `targetSource: 'benchmark' | 'a_priori'`, `targetMedian`, `targetSample` ; le mix porte
  `targetBasis: benchmark | mixed | a_priori`. Le rapport DÉCLARE toujours la source : une
  fourchette a priori est présentée comme un repère, jamais comme une norme.
- `_shared/archetypeWorkbench.ts` — `writeArchetypePrescriptions()` : les arbitrages deviennent des
  tâches dans `architect_workbench` (`source_type='audit_strategic'`, `source_function='marina'`,
  `source_record_id='archetype_<action>_<key>_<domain>'`, donc idempotent). Garde-fou : sur une
  cible a priori, aucune prescription si l'écart à la fourchette est < 8 points.

## Règles à respecter
- Ne jamais présenter `MIX_TARGETS` (a priori) comme un benchmark sectoriel.
- Un benchmark n'est publié qu'à partir de 5 domaines distincts par gabarit.
- Écritures mémoire de marché et prescriptions : toujours non bloquantes pour le rapport.
- À ce jour l'échantillon démarre à zéro : les rapports resteront en mode `a_priori` jusqu'à
  accumulation de 5 domaines par secteur (un backfill des crawls existants reste possible).
