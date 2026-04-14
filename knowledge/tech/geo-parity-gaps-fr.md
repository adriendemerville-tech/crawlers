# Memory: tech/geo-parity-gaps-fr
Updated: 2026-04-14

## Parité GEO — Implémentation Phase 7 ✅

### Éléments exposés aux utilisateurs (Phase 7 complétée)

| Élément | Catalog slug | Consumer | Implémentation |
|---------|-------------|----------|----------------|
| SpeakableSpecification | `schema_speakable` | Code Architect (premium) | injection_catalog + contentBrief schemas |
| Passage Citable GEO | `html_citable_passage` | Code Architect (premium) + Content Architect | injection_catalog + brief `citable_passages_count` + prompt `<blockquote class="citable-passage">` |
| HowTo JSON-LD | `schema_howto` | Code Architect (premium) | Déjà existant dans injection_catalog |
| BreadcrumbList | `schema_breadcrumb` | Code Architect + Audit Expert | Déjà existant |
| Liens d'autorité externes | — | Content Architect + Audit E-E-A-T | `authority_outbound_links` dans brief + requirements matrix |
| Bloc Articles Connexes | `html_related_articles` | Code Architect (gratuit) | injection_catalog |

### Modifications techniques
- **injection_catalog** : +3 entrées (`schema_speakable`, `html_citable_passage`, `html_related_articles`)
- **content_requirements_matrix** : +15 règles pour `speakable_specification`, `citable_passage`, `authority_outbound_links`, `howto_schema`
- **contentBrief.ts** : 
  - `SchemaType` étendu avec `SpeakableSpecification`
  - Nouveaux champs `authority_outbound_links` et `speakable_enabled`
  - Prompt GEO enrichi avec instructions `<blockquote>`, liens d'autorité, SpeakableSpecification
  - Schemas par défaut pour `article` et `landing` incluent `SpeakableSpecification`
