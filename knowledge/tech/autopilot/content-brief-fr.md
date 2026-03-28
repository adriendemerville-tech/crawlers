# Memory: tech/autopilot/content-brief-fr
Updated: 2026-03-28

## ContentBrief — Moteur déterministe pré-LLM

### Principe
Avant tout appel LLM pour produire du contenu, un `ContentBrief` est construit **algorithmiquement** (sans IA). Il impose toutes les contraintes éditoriales. Le LLM reçoit le brief et **exécute** — il ne décide pas de la structure.

### Localisation
`supabase/functions/_shared/contentBrief.ts` — utilisé par :
- `content-architecture-advisor` (Content Architect)
- `parmenion-orchestrator` (Autopilote, phase prescribe contenu)

### Variables du ContentBrief

| Variable | Type | Calcul |
|----------|------|--------|
| `page_type` | landing/product/article/homepage/faq/category | `detectPageType()` partagé |
| `target_length` | {min, max, ideal} | Config par type de page |
| `h2_count` | {min, max} | Config par type |
| `h3_per_h2` | {min, max} | Config par type |
| `tone` | expert-technique/expert-accessible/pedagogique/grand-public/commercial | `jargon_distance` du site |
| `angle` | guide-pratique/comparatif/erreurs-a-eviter/etude-de-cas/etc. | Détection par keyword + titre |
| `cta_type` | demo-request/free-trial/buy-now/newsletter/etc. | Type de page + secteur |
| `cta_count` | number | Config par type |
| `internal_links` | InternalLink[] | `cocoon_auto_links` + `cocoon_sessions` (PageRank) |
| `primary_keyword` | string | Input direct |
| `secondary_keywords` | string[] | Enrichissement workbench |
| `schema_types` | Article/Product/FAQPage/etc. | Config par type |
| `citable_passages_count` | number | Config par type (GEO) |
| `eeat_signals` | string[] | Type de page + YMYL secteur |
| `freshness_markers` | boolean | Toujours true |

### Pipeline complet (Content Architect)

```
1. buildContentBrief()           ← déterministe (_shared/contentBrief.ts)
2. enrichKeywordsForPrescribe()  ← agrégation 4 sources
3. loadContentPromptTemplate()   ← templates BDD
4. briefToPromptBlock()          ← sérialise le brief en texte pour le prompt
5. Prompt LLM                   ← reçoit brief + keywords + template
```

### Pipeline Parménion (prescribe contenu)

```
1. score_workbench_priority()    ← scoring déterministe SQL
2. detectPageType()              ← partagé depuis contentBrief.ts
3. buildContentBrief()           ← pour l'item prioritaire
4. enrichKeywordsForPrescribe()  ← 4 sources
5. loadPromptTemplates()         ← templates BDD
6. briefToPromptBlock()          ← injection dans le prompt
7. Prompt LLM avec CONTENT_TOOLS
```

### Détection du type de page (`detectPageType`)

Partagée entre les deux workflows. Priorité :
1. `finding_category` + `target_operation` du workbench
2. URL patterns (regex)
3. Intent signals (mots dans titre/description)
4. Fallback: `article`

### Résolution du ton (`resolveTone`)

| jargon_distance | Ton |
|----------------|-----|
| 1-3 | expert-technique |
| 4-5 | expert-accessible |
| 6-7 | pédagogique |
| 8-10 | grand-public |
| landing/product | commercial (override) |

### Résolution des liens internes

Sources ordonnées :
1. `cocoon_auto_links` (liens pré-calculés par le moteur de maillage)
2. `cocoon_sessions.nodes_snapshot` (pages à fort PageRank du silo)
3. Limité par `max_internal_links` du type de page

### Futur : paramétrable par l'utilisateur

Les variables du ContentBrief sont pour l'instant calculées automatiquement. La prochaine étape sera de les rendre éditables par l'utilisateur via l'interface (ex: choisir le ton, le nombre de H2, le type de CTA, etc.).
