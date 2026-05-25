---
name: Copilot Market Diagnosis - Page Targeting V2
description: Matrice 8 axes / 8 verdicts pour cibler les pages d'une stratégie SEO, avec PROTECT_PILLAR intouchable et workbench validation
type: feature
---

# Market Diagnosis — Page Targeting V2

Étend la skill `market_diagnosis` (copilot-orchestrator/skills/registry.ts) avec une matrice de ciblage page intelligente.

## Axes (8)
- **A — Audience** : pageviews 30j (ga4_top_pages)
- **B — Pertinence sémantique** : overlap KW vs title+H1
- **C — Potentiel SEO** : volume KW (DataForSEO)
- **D — Profondeur** : 100 - crawl_depth × 15
- **E — Conversion** : page CTA détectée OU bounce<60% & PV>0
- **F — Autorité** : referring_domains (crawl_page_backlinks)
- **G — Rôle cocon** : is_pillar (top 5% authority OU depth≤1+wc≥1200+links≥10 OU rd≥5)
- **H — Saisonnalité** : neutre 50 (réservé V3)

## Verdicts (ordre de priorité)
1. **PROTECT_PILLAR** — page pilier, INTOUCHABLE, créer page neuve
2. **PROTECT_REVENUE** — page CTA, ne pas détourner intention business
3. **PROTECT_AUTHORITY** — F≥60, enrichir sans changer angle
4. **PROTECT_TRAFFIC** — A≥50 & B<30, trafic vaniteux mais réel
5. **OPTIMIZE** — A≥30 & B≥50, enrichir
6. **BOOST** — A<30 & B≥50, page dormante alignée, pousser maillage
7. **REPURPOSE** — détournement OK (max 3/diagnostic)
8. **ARCHIVE** — A<10 & B<30 & F<10 & depth≥3, 301/410

## Modulation business_model (tracked_sites.business_model)
- ecommerce/product/saas_b2c → E=35
- media/blog/publisher → A=35
- b2b/service/agency → F=25, E=20
- default → A=20, B=20, C=20, E=15, F=10

## Garde-fous
- **min 2 axes mesurés** sinon INSUFFICIENT_DATA
- **cooldown 90j** : exclut URLs déjà dans architect_workbench (même domain)
- **max 3 REPURPOSE / diagnostic**
- max 10 décisions au total

## Sortie
- `data.page_targeting.decisions[]` — verdict, score 0-100, risk_note, action
- Insert dans `architect_workbench` avec source_type='felix', source_function='market_diagnosis', finding_category='page_targeting', status='pending', payload.verdict
- Validation manuelle requise dans Mes Sites > Plan d'action (workbench UI)
